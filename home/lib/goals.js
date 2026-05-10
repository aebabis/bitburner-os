import { getStaticData, getGoalsData, getPlayerData } from "./data-store";
import { getRepTargets, getTargetFaction } from "./query-service";
import { MEDIUM } from "./colors";
import { COMBAT_REQUIREMENTS, HACKING_REQUIREMENTS } from "../bin/self/aug/factions";
import { THREADPOOL } from "../etc/config";

/**
 * @typedef {'JOB_RAM' | 'AUG_SUITE' | 'FACTION_JOIN' | 'FACTION_REP' | 'AUGMENTATION' | 'COMBAT_LEVELS' | 'HACKING_LEVEL'} GoalType
 */

/**
 * @typedef {{
 *   type: GoalType,
 *   desc: string,
 *   isDone: () => boolean,
 *   toString: () => string,
 *   requirement: number | undefined,
 *   faction: string | undefined,
 * }} Goal
 */

export const COMBAT_STATS = /** @type {(keyof Skills)[]} */ (["strength", "defense", "dexterity", "agility"]);

/**
 * @param {GoalType} type
 * @param {string} desc
 * @param {() => boolean} isDone
 * @param {number} [requirement]
 * @param {string} [faction]
 * @returns {Goal}
 */
export const goal = (type, desc, isDone, requirement = undefined, faction = undefined) => ({
  type,
  desc,
  isDone,
  requirement,
  faction,
  toString: () => isDone() ? desc : MEDIUM(desc),
});

/** @param {NS} ns @returns {Goal[]} */
export const getGoals = (ns) => {
  const { factions } = ns.getPlayer();
  const { factionRep, purchasedAugmentations } = getPlayerData(ns);
  const staticData = getStaticData(ns);
  const { requiredJobRam } = staticData;
  const goalsData = getGoalsData(ns);
  const effectiveFaction = getTargetFaction(ns);
  const originalFaction = goalsData.targetFaction ?? staticData.targetFaction;
  const targetAugmentations = goalsData.targetAugmentations ?? staticData.targetAugmentations;

  if (targetAugmentations == null) {
    const POOL1 = `${THREADPOOL}-01`;
    return [
      goal("JOB_RAM", `${requiredJobRam}GB on ${POOL1}`,
        () => ns.getServer(POOL1).maxRam >= requiredJobRam),
      goal("AUG_SUITE", "Run augmentation suite", () => false),
    ];
  }

  const combatReq = /** @type {Record<string,number>} */ (COMBAT_REQUIREMENTS)[originalFaction];
  const hackReq = /** @type {Record<string,number>} */ (HACKING_REQUIREMENTS)[originalFaction];

  const goals = [];

  if (hackReq != null) {
    goals.push(goal("HACKING_LEVEL", `Hacking ≥ ${hackReq}`,
      () => ns.getPlayer().skills.hacking >= hackReq, hackReq));
  }
  if (combatReq != null) {
    goals.push(goal("COMBAT_LEVELS", `Combat stats ≥ ${combatReq}`,
      () => COMBAT_STATS.every(stat => ns.getPlayer().skills[stat] >= combatReq), combatReq));
  }

  goals.push(
    goal("FACTION_JOIN", "Join " + effectiveFaction, () => factions.includes(effectiveFaction)),
  );

  for (const { faction, requirement } of getRepTargets(ns)) {
    if (faction !== effectiveFaction)
      goals.push(goal("FACTION_JOIN", "Join " + faction, () => factions.includes(faction)));
    goals.push(goal("FACTION_REP", `Gain ${requirement} rep (${faction})`,
      () => (factionRep?.[faction] ?? 0) >= requirement, requirement, faction));
  }

  goals.push(
    ...targetAugmentations.map((/** @type {string} */ aug) =>
      goal("AUGMENTATION", aug, () => purchasedAugmentations.includes(aug))),
  );

  return goals;
};

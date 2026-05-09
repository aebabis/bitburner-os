import { getStaticData, getGoalsData, getPlayerData, getGangData } from "./data-store";
import { getRepNeeded, getTargetFaction } from "./query-service";
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
  const { requiredJobRam, factionAugmentations = {}, augmentationRepReqs = {} } = staticData;
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

  const gangFaction = getGangData(ns)?.gangInfo?.faction;
  const isGangTarget = effectiveFaction === gangFaction && gangFaction !== originalFaction;

  if (isGangTarget) {
    const gangAugs = /** @type {string[]} */ (factionAugmentations[gangFaction] ?? []);
    const gangTargetAugs = targetAugmentations.filter((/** @type {string} */ aug) => gangAugs.includes(aug));
    const factionOnlyAugs = targetAugmentations.filter((/** @type {string} */ aug) => !gangAugs.includes(aug));

    const maxRep = (/** @type {string[]} */ augs) =>
      Math.max(...augs.map((/** @type {string} */ aug) => augmentationRepReqs[aug] ?? 0));

    if (gangTargetAugs.length > 0) {
      const req = maxRep(gangTargetAugs);
      goals.push(goal("FACTION_REP", `Gain ${req} rep (${gangFaction})`,
        () => (factionRep[gangFaction] ?? 0) >= req, req, gangFaction));
    }
    if (factionOnlyAugs.length > 0) {
      const req = maxRep(factionOnlyAugs);
      goals.push(goal("FACTION_REP", `Gain ${req} rep (${originalFaction})`,
        () => (factionRep[originalFaction] ?? 0) >= req, req, originalFaction));
    }
  } else {
    const repNeeded = getRepNeeded(ns);
    goals.push(goal("FACTION_REP", `Gain ${repNeeded} rep (${effectiveFaction})`,
      () => repNeeded != null && (factionRep[effectiveFaction] ?? 0) >= repNeeded,
      repNeeded ?? undefined, effectiveFaction));
  }

  goals.push(
    ...targetAugmentations.map((/** @type {string} */ aug) =>
      goal("AUGMENTATION", aug, () => purchasedAugmentations.includes(aug))),
  );

  return goals;
};

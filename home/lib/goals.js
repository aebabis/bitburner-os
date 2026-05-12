import { getStaticData, getGoalsData, getPlayerData } from "./data-store";
import { getRepTargets, getTargetFaction } from "./query-service";
import { MEDIUM } from "./colors";
import { THREADPOOL } from "../etc/config";

/**
 * @typedef {'JOB_RAM' | 'AUG_SUITE' | 'FACTION_JOIN' | 'FACTION_REP' | 'AUGMENTATION' | 'COMBAT_LEVELS' | 'HACKING_LEVEL' | 'LOCATION' | 'MONEY' } GoalType
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
const goal = (type, desc, isDone, requirement = undefined, faction = undefined) => ({
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
  const { requiredJobRam, factionRequirements } = staticData;
  const goalsData = getGoalsData(ns);
  const effectiveFaction = getTargetFaction(ns);
  const targetAugmentations = goalsData.targetAugmentations ?? staticData.targetAugmentations;

  if (targetAugmentations == null) {
    const POOL1 = `${THREADPOOL}-01`;
    return [
      goal("JOB_RAM", `${requiredJobRam}GB on ${POOL1}`,
        () => ns.serverExists(POOL1) && ns.getServerMaxRam(POOL1) >= requiredJobRam),
      goal("AUG_SUITE", "Run augmentation suite", () => false),
    ];
  }

  const repTargets = getRepTargets(ns);
  const goals = [];

  const nonGangTarget = repTargets.find((target) => !target.isGang);
  if (nonGangTarget) {
    const requirements = factionRequirements?.[nonGangTarget.faction]??[];
    const skillReqs = Object.assign({}, ...(requirements)
      .filter((req) => req.type === 'skills')
      .map((req) => req.skills));
    const moneyTarget = requirements.find((req) => req.type === 'money')?.money;
    const combatReq = skillReqs.strength;
    const hackReq = skillReqs.hacking;
    const locationReqs = [
      ...requirements.filter((req) => req.type === 'city'),
      ...requirements.filter((req) => req.type === 'someCondition')
        .flatMap((req) => req.conditions).filter((req) => req.type === 'city')
    ].map((req) => req.city);

    if (hackReq != null) {
      goals.push(goal("HACKING_LEVEL", `Hacking ≥ ${hackReq}`,
        () => ns.getPlayer().skills.hacking >= hackReq, hackReq));
    }
    if (combatReq != null) {
      goals.push(goal("COMBAT_LEVELS", `Combat stats ≥ ${combatReq}`,
        () => COMBAT_STATS.every(stat => ns.getPlayer().skills[stat] >= combatReq), combatReq));
    }
    // Money and location sub-goals for joining a faction
    // are no longer considered requirements once the
    // faction is joined.
    // The level goals above are kept because they can't
    // be invalidated, but they could be nested here to 
    // save space in the user's dashboard.
    if (!factions.includes(nonGangTarget.faction)) {
      if (moneyTarget) {
        goals.push(
          goal("MONEY", "Have $" + ns.formatNumber(moneyTarget, 1), () => ns.getPlayer().money >= moneyTarget, moneyTarget),
        );
      }
      const [location] = locationReqs;
      goals.push(
        goal("LOCATION", "Visit " + location, () => ns.getPlayer().location === location, location),
      );
    }
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

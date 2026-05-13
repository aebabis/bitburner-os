import { getStaticData, getGoalsData, getPlayerData, getMoneyData } from "./data-store";
import { getRepTargets, getTargetFaction } from "./query-service";
import { MEDIUM } from "./colors";
import { THREADPOOL } from "../etc/config";

/**
 * @typedef {'JOB_RAM' | 'AUG_SUITE' | 'FACTION_JOIN' | 'FACTION_REP' | 'AUGMENTATION' | 'COMBAT_LEVELS' | 'HACKING_LEVEL' | 'LOCATION' | 'MONEY' | 'AUG_MONEY'} GoalType
 */

/**
 * @typedef {{
 *   type: GoalType,
 *   desc: string,
 *   isDone: () => boolean,
 *   toString: () => string,
 *   requirement: number | undefined,
 *   faction: string | undefined,
 *   deps: Goal[],
 * }} Goal
 */

export const COMBAT_STATS = /** @type {(keyof Skills)[]} */ (["strength", "defense", "dexterity", "agility"]);

/**
 * @param {GoalType} type
 * @param {string} desc
 * @param {() => boolean} isDone
 * @param {number} [requirement]
 * @param {string} [faction]
 * @param {Goal[]} [deps]
 * @returns {Goal}
 */
const goal = (type, desc, isDone, requirement = undefined, faction = undefined, deps = []) => ({
  type,
  desc,
  isDone,
  requirement,
  faction,
  deps,
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
    const jobRamGoal = goal("JOB_RAM", `${requiredJobRam}GB on ${POOL1}`,
      () => ns.serverExists(POOL1) && ns.getServerMaxRam(POOL1) >= requiredJobRam);
    return [
      jobRamGoal,
      goal("AUG_SUITE", "Run augmentation suite", () => false, undefined, undefined, [jobRamGoal]),
    ];
  }

  const repTargets = getRepTargets(ns);
  const goals = [];

  // Collect prereqs for joining the non-gang target faction so they can be
  // wired as deps on that faction's FACTION_JOIN goal below.
  const joinPrereqs = [];
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
      const hackGoal = goal("HACKING_LEVEL", `Hacking ≥ ${hackReq}`,
        () => ns.getPlayer().skills.hacking >= hackReq, hackReq);
      goals.push(hackGoal);
      joinPrereqs.push(hackGoal);
    }
    if (combatReq != null) {
      const combatGoal = goal("COMBAT_LEVELS", `Combat stats ≥ ${combatReq}`,
        () => COMBAT_STATS.every(stat => ns.getPlayer().skills[stat] >= combatReq), combatReq);
      goals.push(combatGoal);
      joinPrereqs.push(combatGoal);
    }
    // Money and location sub-goals for joining a faction
    // are no longer considered requirements once the
    // faction is joined.
    // The level goals above are kept because they can't
    // be invalidated, but they could be nested here to
    // save space in the user's dashboard.
    if (!factions.includes(nonGangTarget.faction)) {
      if (moneyTarget) {
        const moneyGoal = goal("MONEY", "Have $" + ns.formatNumber(moneyTarget, 1),
          () => ns.getPlayer().money >= moneyTarget, moneyTarget);
        goals.push(moneyGoal);
        joinPrereqs.push(moneyGoal);
      }
      const [location] = locationReqs;
      const locationGoal = goal("LOCATION", "Visit " + location,
        () => ns.getPlayer().location === location, location);
      goals.push(locationGoal);
      joinPrereqs.push(locationGoal);
    }
  }

  const effectiveFactionPrereqs = nonGangTarget?.faction === effectiveFaction ? joinPrereqs : [];
  const effectiveJoinGoal = goal("FACTION_JOIN", "Join " + effectiveFaction,
    () => factions.includes(effectiveFaction), undefined, undefined, effectiveFactionPrereqs);
  goals.push(effectiveJoinGoal);

  const repGoals = [];
  for (const { faction, requirement } of getRepTargets(ns)) {
    let factionJoinGoal = effectiveJoinGoal;
    if (faction !== effectiveFaction) {
      const factionPrereqs = faction === nonGangTarget?.faction ? joinPrereqs : [];
      factionJoinGoal = goal("FACTION_JOIN", "Join " + faction,
        () => factions.includes(faction), undefined, undefined, factionPrereqs);
      goals.push(factionJoinGoal);
    }
    const repGoal = goal("FACTION_REP", `Gain ${requirement} rep (${faction})`,
      () => (factionRep?.[faction] ?? 0) >= requirement, requirement, faction, [factionJoinGoal]);
    goals.push(repGoal);
    repGoals.push(repGoal);
  }

  const { estimatedStockValue = 0, costToAug } = getMoneyData(ns);
  const augMoneyGoal = goal(
    "AUG_MONEY",
    "Save " + (costToAug != null ? "$" + ns.formatNumber(costToAug, 1) : "?") + " for augmentations",
    () => costToAug != null && ns.getPlayer().money + 0.9 * estimatedStockValue >= costToAug,
  );
  goals.push(augMoneyGoal);

  goals.push(
    ...targetAugmentations.map((/** @type {string} */ aug) =>
      goal("AUGMENTATION", aug, () => purchasedAugmentations.includes(aug),
        undefined, undefined, [...repGoals, augMoneyGoal])),
  );

  return goals;
};

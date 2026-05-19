import { DARK } from "../colors.js";

const fmt = new Intl.NumberFormat("en", { notation: "compact" });
const fmtMoney = (/** @type {number} */ n) => '$' + fmt.format(n);

/**
 * @typedef {'JOB_RAM' | 'INSTALL' | 'FACTION_JOIN' | 'FACTION_REP' | 'AUGMENTATION' | 'COMBAT_LEVELS' | 'HACKING_LEVEL' | 'KILLS' | 'KARMA' | 'LOCATION' | 'MONEY' | 'AUG_MONEY'} GoalType
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
 *   ownTime: () => number | null,
 *   timeToComplete: () => number | null,
 * }} Goal
 */

export const COMBAT_STATS = /** @type {(keyof GymEnumType)[]} */ (["strength", "defense", "dexterity", "agility"]);
export const NEUROFLUX = 'NeuroFlux Governor';

/**
 * @param {GoalType} type
 * @param {string} desc
 * @param {() => boolean} isDone
 * @param {{ requirement?: number, faction?: string, deps?: Goal[], ownTime?: () => number | null }} [opts]
 * @returns {Goal}
 */
const goal = (type, desc, isDone, { requirement, faction, deps = [], ownTime = () => null } = {}) => {
  let _ttc;
  return {
    type, desc, isDone, requirement, faction, deps, ownTime,
    toString: () => isDone() ? desc : DARK(desc),
    timeToComplete() {
      if (_ttc !== undefined) return _ttc;
      if (isDone()) return (_ttc = 0);
      const depsMax = deps.length === 0 ? 0
        : Math.max(...deps.map(d => d.timeToComplete() ?? Infinity));
      return (_ttc = depsMax === Infinity || ownTime() == null ? null : depsMax + ownTime());
    },
  };
};

/** @param {string} poolServer @param {number} currentRam @param {number} requiredJobRam @param {number} jobRamCost @param {number} currentMoney @param {number} referenceIncome @returns {Goal} */
export const jobRamGoal = (poolServer, currentRam, requiredJobRam, jobRamCost, currentMoney, referenceIncome) =>
  goal("JOB_RAM", `${requiredJobRam}GB on ${poolServer}`,
    () => currentRam >= requiredJobRam,
    {
      requirement: requiredJobRam,
      ownTime: () => referenceIncome > 0 ? Math.max(0, jobRamCost - currentMoney) / referenceIncome : null,
    });

/** @param {import('./nodes.js').Goal[]} deps @returns {Goal} */
export const installGoal = (deps) =>
  goal("INSTALL", "Run augmentation suite", () => false, { deps, ownTime: () => 0 });

/** @param {number} hackReq @param {number} currentHacking @param {number|null} [trainingTime] @returns {Goal} */
export const hackingLevelGoal = (hackReq, currentHacking, trainingTime = null) =>
  goal("HACKING_LEVEL", `Hacking ≥ ${hackReq}`, () => currentHacking >= hackReq,
    { requirement: hackReq, ownTime: () => trainingTime });

/** @param {number} combatReq @param {Skills} currentSkills @param {number|null} [trainingTime] @returns {Goal} */
export const combatLevelsGoal = (combatReq, currentSkills, trainingTime = null) =>
  goal("COMBAT_LEVELS", `Combat stats ≥ ${combatReq}`,
    () => COMBAT_STATS.every(stat => currentSkills[stat] >= combatReq),
    { requirement: combatReq, ownTime: () => trainingTime });

/** @param {number} killsRequired @param {number} numPeopleKilled @returns {Goal} */
export const killsGoal = (killsRequired, numPeopleKilled) =>
  goal("KILLS", `Kill ${killsRequired} people`,
    () => numPeopleKilled >= killsRequired,
    { requirement: numPeopleKilled, ownTime: () => (killsRequired - numPeopleKilled) * 3 });

/** @param {number} karmaRequired @param {number} karma @returns {Goal} */
export const karmaGoal = (karmaRequired, karma) =>
  goal("KARMA", `Have ${karmaRequired} karma`,
    () => karmaRequired >= karma,
    { requirement: karmaRequired, ownTime: () => -(karmaRequired - karma) });

/** @param {number} moneyTarget @param {number} currentMoney @param {number} referenceIncome @returns {Goal} */
export const moneyPrereqGoal = (moneyTarget, currentMoney, referenceIncome) =>
  goal("MONEY", `Have ${fmtMoney(moneyTarget)}`,
    () => currentMoney >= moneyTarget,
    {
      requirement: moneyTarget,
      ownTime: () => referenceIncome > 0 ? Math.max(0, moneyTarget - currentMoney) / referenceIncome : null,
    });

/** @param {string} location @param {string} currentLocation @returns {Goal} */
export const locationGoal = (location, currentLocation) =>
  goal("LOCATION", "Visit " + location,
    () => currentLocation === location,
    { requirement: /** @type {any} */ (location), ownTime: () => 0 });

/** @param {string} faction @param {string[]} factions @param {Goal[]} [deps] @returns {Goal} */
export const factionJoinGoal = (faction, factions, deps = []) =>
  goal("FACTION_JOIN", "Join " + faction, () => factions.includes(faction), { deps, ownTime: () => 0 });

/**
 * @param {string} faction
 * @param {number} requirement
 * @param {Record<string,number>} factionRep
 * @param {Goal} dep
 * @param {number|undefined} repRate
 * @returns {Goal}
 */
export const factionRepGoal = (faction, requirement, factionRep, dep, repRate) => {
  const currentRep = factionRep?.[faction] ?? 0;
  return goal("FACTION_REP", `Gain ${requirement} rep (${faction})`,
    () => currentRep >= requirement,
    {
      requirement, faction, deps: [dep],
      ownTime: () => repRate > 0 ? Math.max(0, requirement - currentRep) / repRate : null,
    });
};

/** @param {number | undefined} costToAug @param {number} currentMoney @param {number} referenceIncome @returns {Goal} */
export const augMoneyGoal = (costToAug, currentMoney, referenceIncome) =>
  goal("AUG_MONEY",
    "Save " + (costToAug != null ? fmtMoney(costToAug) : "?") + " for augmentations",
    () => costToAug != null && currentMoney >= costToAug,
    {
      requirement: costToAug,
      ownTime: () => costToAug != null && referenceIncome > 0
        ? Math.max(0, costToAug - currentMoney) / referenceIncome
        : null,
    });

/** @param {string} aug @param {string} faction @param {string[]} purchasedAugmentations @param {Goal[]} deps @returns {Goal} */
export const augmentationGoal = (aug, faction, purchasedAugmentations, deps) =>
  goal("AUGMENTATION", aug,
    () => purchasedAugmentations.includes(aug),
    { faction, deps, ownTime: () => 0 });

/**
 * One level of Neuroflux Governor. isDone when the player has purchased at least
 * `ordinal` levels total (counting from 1).
 * @param {number} ordinal @param {string} faction @param {string[]} purchasedAugmentations @param {Goal[]} deps @returns {Goal}
 */
export const neurofluxGoal = (ordinal, faction, purchasedAugmentations, deps) =>
  goal("AUGMENTATION", NEUROFLUX,
    () => purchasedAugmentations.filter(a => a === NEUROFLUX).length >= ordinal,
    { faction, deps, ownTime: () => 0 });

// Port program costs in purchase order; used to estimate backdoor access cost.
// TODO: Exclude programs the player already owns; consider fetching costs via ns.
const PORT_PROGRAM_COSTS = [500e3, 1500e3, 5e6, 30e6, 250e6];
const EXP_PER_SECOND = 10;

/**
 * @param {number} requirement
 * @param {number} currentLevel
 * @param {string} stat
 * @param {string[]} installedAugs
 * @param {Record<string,any>|undefined} augmentationStats
 * @param {any} formulas
 * @returns {number|null}
 */
const skillTrainingTime = (requirement, currentLevel, stat, installedAugs, augmentationStats, formulas) => {
  if (!formulas) return null;
  let levelMult = 1, expMult = 1;
  for (const aug of installedAugs) {
    const s = augmentationStats?.[aug];
    if (s?.[stat] != null) levelMult *= s[stat];
    if (s?.[`${stat}_exp`] != null) expMult *= s[`${stat}_exp`];
  }
  const currentExp = formulas.skills.calculateExp(currentLevel ?? 1, levelMult);
  const expReq = formulas.skills.calculateExp(requirement, levelMult);
  return Math.max(0, expReq - currentExp) / expMult / EXP_PER_SECOND;
};

/**
 * Build the join prereq subtree for a faction.
 * Returns early (already-joined short-circuit) when player is already a member.
 * @param {string} faction
 * @param {{
 *   player: Player,
 *   staticData: any,
 *   money: number,
 *   referenceIncome: number,
 *   karma: number,
 *   formulas?: any,
 * }} data
 * @returns {{ joinPrereqs: Goal[], joinGoal: Goal }}
 */
export const buildJoinSubtree = (faction, {
  player, staticData, money, referenceIncome, karma, formulas = null,
}) => {
  const { factions, skills, location } = player;
  const { factionRequirements, ownedAugmentations: installedAugs = [], augmentationStats, serverBackdoorRequirements } = staticData;

  if (factions.includes(faction)) {
    return { joinPrereqs: [], joinGoal: factionJoinGoal(faction, factions, []) };
  }

  const joinPrereqs = [];
  const requirements = factionRequirements?.[faction] ?? [];
  const skillReqs = Object.assign({}, ...requirements.filter(r => r.type === 'skills').map(r => r.skills));
  const karmaReq = requirements.find(r => r.type === 'karma')?.karma ?? 0;
  const killsReq = requirements.find(r => r.type === 'numPeopleKilled')?.numPeopleKilled ?? 0;
  const moneyTarget = requirements.find(r => r.type === 'money')?.money ?? 0;
  const locationReqs = [
    ...requirements.filter(r => r.type === 'city'),
    ...requirements.filter(r => r.type === 'someCondition').flatMap(r => r.conditions).filter(r => r.type === 'city'),
  ].map(r => r.city);

  const bdReq = requirements.find(r => r.type === 'backdoorInstalled');
  let bdHackReq = 0, bdMoney = 0;
  if (bdReq && serverBackdoorRequirements) {
    const serverReq = serverBackdoorRequirements.find(s => s.hostname === bdReq.server);
    if (serverReq) {
      bdHackReq = serverReq.requiredHackingLevel;
      bdMoney = PORT_PROGRAM_COSTS
        .filter((_, i) => i < serverReq.numPortsRequired)
        .reduce((a, b) => a + b, 0);
    }
  }

  // Combine explicit skill req with backdoor hacking req; only one goal needed.
  const hackReq = Math.max(skillReqs.hacking ?? 0, bdHackReq) || null;
  const combatReq = skillReqs.strength ?? null;

  if (hackReq != null) {
    const t = skillTrainingTime(hackReq, skills.hacking ?? 1, 'hacking', installedAugs, augmentationStats, formulas);
    joinPrereqs.push(hackingLevelGoal(hackReq, skills.hacking ?? 0, t));
  }
  if (combatReq != null) {
    const times = formulas
      ? COMBAT_STATS.map(stat => skillTrainingTime(combatReq, skills[stat] ?? 1, stat, installedAugs, augmentationStats, formulas) ?? 0)
      : null;
    const t = times ? Math.max(...times) : null;
    joinPrereqs.push(combatLevelsGoal(combatReq, skills, t));
  }
  if (killsReq) joinPrereqs.push(killsGoal(killsReq, player.numPeopleKilled ?? 0));
  if (karmaReq) joinPrereqs.push(karmaGoal(karmaReq, karma));
  const totalMoneyTarget = moneyTarget + bdMoney;
  if (totalMoneyTarget > 0) joinPrereqs.push(moneyPrereqGoal(totalMoneyTarget, money, referenceIncome));
  const [loc] = locationReqs;
  if (loc) joinPrereqs.push(locationGoal(loc, location));

  const joinGoal = factionJoinGoal(faction, factions, joinPrereqs);
  return { joinPrereqs, joinGoal };
};

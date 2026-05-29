import { C } from '../colors.ts';

const fmt = new Intl.NumberFormat('en', { notation: 'compact' });
const fmtMoney = (n: number) => '$' + fmt.format(n);
const fmtRep = (n: number) => fmt.format(n);

type GoalType =
  | 'JOB_RAM'
  | 'INSTALL'
  | 'FACTION_JOIN'
  | 'FACTION_REP'
  | 'FACTION_FAVOR'
  | 'BUY_REP'
  | 'AUGMENTATION'
  | 'COMBAT_LEVELS'
  | 'HACKING_LEVEL'
  | 'KILLS'
  | 'KARMA'
  | 'LOCATION'
  | 'MONEY'
  | 'AUG_MONEY';

export type Goal = {
  type: GoalType;
  desc: string;
  isDone: () => boolean;
  toString: () => string;
  requirement: number | undefined;
  faction: string | undefined;
  deps: Goal[];
  value: number;
  ownTime: () => number | null;
  timeToComplete: () => number | null;
};

export const COMBAT_STATS = /** @type {(keyof GymEnumType)[]} */ [
  'strength',
  'defense',
  'dexterity',
  'agility',
];
export const NEUROFLUX = 'NeuroFlux Governor';

/**
 * @param {GoalType} type
 * @param {string} desc
 * @param {() => boolean} isDone
 * @param {{ requirement?: number, faction?: string, deps?: Goal[], value?: number, ownTime?: () => number | null }} [opts]
 * @returns {Goal}
 */
const goal = (
  type,
  desc,
  isDone,
  { requirement, faction, deps = [], value = 0, ownTime = () => null } = {},
) => {
  let _ttc;
  return {
    type,
    desc,
    isDone,
    requirement,
    faction,
    deps,
    value,
    ownTime,
    toString: () => (isDone() ? desc : C(57)(desc)),
    timeToComplete() {
      if (_ttc !== undefined) return _ttc;
      if (isDone()) return (_ttc = 0);
      const depsMax =
        deps.length === 0
          ? 0
          : Math.max(...deps.map((d) => d.timeToComplete() ?? Infinity));
      return (_ttc =
        depsMax === Infinity || ownTime() == null ? null : depsMax + ownTime());
    },
  };
};

/** @param {string} poolServer @param {number} currentRam @param {number} requiredJobRam @param {number} jobRamCost @param {number} currentMoney @param {number} referenceIncome @returns {Goal} */
export const jobRamGoal = (
  poolServer,
  currentRam,
  requiredJobRam,
  jobRamCost,
  currentMoney,
  referenceIncome,
) =>
  goal(
    'JOB_RAM',
    `${requiredJobRam}GB on ${poolServer}`,
    () => currentRam >= requiredJobRam,
    {
      requirement: requiredJobRam,
      ownTime: () =>
        referenceIncome > 0
          ? Math.max(0, jobRamCost - currentMoney) / referenceIncome
          : null,
    },
  );

/** @param {import('./nodes.ts').Goal[]} deps @param {string} [desc] @returns {Goal} */
export const installGoal = (deps, desc = 'Run augmentation suite') =>
  goal('INSTALL', desc, () => false, {
    deps,
    value: deps.reduce((s, d) => s + d.value, 0),
    ownTime: () => 0,
  });

/** @param {number} hackReq @param {number} currentHacking @param {number|null} [trainingTime] @returns {Goal} */
export const hackingLevelGoal = (
  hackReq,
  currentHacking,
  trainingTime = null,
) =>
  goal(
    'HACKING_LEVEL',
    `Hacking ≥ ${hackReq}`,
    () => currentHacking >= hackReq,
    { requirement: hackReq, ownTime: () => trainingTime },
  );

/** @param {number} combatReq @param {Skills} currentSkills @param {number|null} [trainingTime] @returns {Goal} */
export const combatLevelsGoal = (
  combatReq,
  currentSkills,
  trainingTime = null,
) =>
  goal(
    'COMBAT_LEVELS',
    `Combat stats ≥ ${combatReq}`,
    () => COMBAT_STATS.every((stat) => currentSkills[stat] >= combatReq),
    { requirement: combatReq, ownTime: () => trainingTime },
  );

/** @param {number} killsRequired @param {number} numPeopleKilled @returns {Goal} */
export const killsGoal = (killsRequired, numPeopleKilled) =>
  goal(
    'KILLS',
    `Kill ${killsRequired} people`,
    () => numPeopleKilled >= killsRequired,
    {
      requirement: numPeopleKilled,
      ownTime: () => (killsRequired - numPeopleKilled) * 3,
    },
  );

/** @param {number} karmaRequired @param {number} karma @returns {Goal} */
export const karmaGoal = (karmaRequired, karma) =>
  goal('KARMA', `Have ${karmaRequired} karma`, () => karmaRequired >= karma, {
    requirement: karmaRequired,
    ownTime: () => -(karmaRequired - karma),
  });

/** @param {number} moneyTarget @param {number} currentMoney @param {number} referenceIncome @returns {Goal} */
export const moneyPrereqGoal = (moneyTarget, currentMoney, referenceIncome) =>
  goal(
    'MONEY',
    `Have ${fmtMoney(moneyTarget)}`,
    () => currentMoney >= moneyTarget,
    {
      requirement: moneyTarget,
      ownTime: () =>
        referenceIncome > 0
          ? Math.max(0, moneyTarget - currentMoney) / referenceIncome
          : null,
    },
  );

/** @param {string} location @param {string} currentLocation @returns {Goal} */
export const locationGoal = (location, currentLocation) =>
  goal('LOCATION', 'Visit ' + location, () => currentLocation === location, {
    requirement: /** @type {any} */ location,
    ownTime: () => 0,
  });

/** @param {string} faction @param {string[]} factions @param {Goal[]} [deps] @returns {Goal} */
export const factionJoinGoal = (faction, factions, deps = []) =>
  goal('FACTION_JOIN', 'Join ' + faction, () => factions.includes(faction), {
    faction,
    deps,
    ownTime: () => 0,
  });

/**
 * @param {string} faction
 * @param {number} requirement
 * @param {number} currentRep
 * @param {Goal} dep
 * @param {number|undefined} repRate
 * @returns {Goal}
 */
export const factionRepGoal = (
  faction,
  requirement,
  currentRep,
  dep,
  repRate,
) =>
  goal(
    'FACTION_REP',
    `Gain ${requirement} rep (${faction})`,
    () => currentRep >= requirement,
    {
      requirement,
      faction,
      deps: [dep],
      ownTime: () =>
        repRate > 0 ? Math.max(0, requirement - currentRep) / repRate : null,
    },
  );

/** @param {number | undefined} costToAug @param {number} liquidAssets @param {number} referenceIncome @returns {Goal} */
export const augMoneyGoal = (costToAug, liquidAssets, referenceIncome) =>
  goal(
    'AUG_MONEY',
    'Save ' +
      (costToAug != null ? fmtMoney(costToAug) : '?') +
      ' for augmentations',
    () => costToAug != null && liquidAssets >= costToAug,
    {
      requirement: costToAug,
      ownTime: () =>
        costToAug != null && referenceIncome > 0
          ? Math.max(0, costToAug - liquidAssets) / referenceIncome
          : null,
    },
  );

/** @param {string} aug @param {string} faction @param {string[]} purchasedAugmentations @param {Goal[]} deps @param {number} [value] @returns {Goal} */
export const augmentationGoal = (
  aug,
  faction,
  purchasedAugmentations,
  deps,
  value = 0,
) =>
  goal('AUGMENTATION', aug, () => purchasedAugmentations.includes(aug), {
    faction,
    deps,
    value,
    ownTime: () => 0,
  });

/**
 * One level of Neuroflux Governor. isDone when the player has purchased at least
 * `ordinal` levels total (counting from 1).
 * @param {number} ordinal @param {string} faction @param {string[]} purchasedAugmentations @param {Goal[]} deps @param {number} [value] @returns {Goal}
 */
export const neurofluxGoal = (
  ordinal,
  faction,
  purchasedAugmentations,
  deps,
  value = 0,
) =>
  goal(
    'AUGMENTATION',
    NEUROFLUX,
    () =>
      purchasedAugmentations.filter((a) => a === NEUROFLUX).length >= ordinal,
    { faction, deps, value, ownTime: () => 0 },
  );

/**
 * @param {string} faction
 * @param {number} repForFavor - rep required so next reset reaches favorToDonate
 * @param {number} currentRep
 * @param {number} currentFavor
 * @param {number} favorGain - favor gained at next reset
 * @param {number} favorToDonate
 * @param {number|undefined} repRate
 * @param {Goal} dep - joinGoal
 * @returns {Goal}
 */
export const factionFavorGoal = (
  faction,
  repForFavor,
  currentRep,
  currentFavor,
  favorGain,
  favorToDonate,
  repRate,
  dep,
) => {
  const remaining = Math.max(0, repForFavor - currentRep);
  return goal(
    'FACTION_FAVOR',
    `${fmtRep(remaining)} rep for favor (${faction})`,
    () => currentFavor + favorGain >= favorToDonate,
    {
      requirement: repForFavor,
      faction,
      deps: [dep],
      ownTime: () => (repRate > 0 ? remaining / repRate : null),
      isDone: () => remaining <= 0,
    },
  );
};

/**
 * @param {string} faction
 * @param {number} repRequired
 * @param {number} currentRep
 * @param {Goal[]} deps
 * @returns {Goal}
 */
export const buyRepGoal = (faction, repRequired, currentRep, deps) =>
  goal(
    'BUY_REP',
    `Buy ${fmtRep(repRequired)} rep (${faction})`,
    () => currentRep >= repRequired,
    { faction, deps, requirement: repRequired - currentRep, ownTime: () => 0 },
  );

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

interface GoalProps {
  requirement?: number;
  faction?: string;
  deps?: Goal[];
  value?: number;
  ownTime?: () => number | null;
}
const goal = (
  type: GoalType,
  desc: string,
  isDone: () => boolean,
  {
    requirement,
    faction,
    deps = [],
    value = 0,
    ownTime = () => null,
  }: GoalProps = {},
) => {
  let _ttc: number;
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

export const jobRamGoal = (
  poolServer: string,
  currentRam: number,
  requiredJobRam: number,
  jobRamCost: number,
  currentMoney: number,
  referenceIncome: number,
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

export const installGoal = (deps: Goal[], desc = 'Run augmentation suite') =>
  goal('INSTALL', desc, () => false, {
    deps,
    value: deps.reduce((s, d) => s + d.value, 0),
    ownTime: () => 0,
  });

export const hackingLevelGoal = (
  hackReq: number,
  currentHacking: number,
  trainingTime: number | null = null,
) =>
  goal(
    'HACKING_LEVEL',
    `Hacking ≥ ${hackReq}`,
    () => currentHacking >= hackReq,
    { requirement: hackReq, ownTime: () => trainingTime },
  );

export const combatLevelsGoal = (
  combatReq: number,
  currentSkills: number,
  trainingTime: number | null = null,
) =>
  goal(
    'COMBAT_LEVELS',
    `Combat stats ≥ ${combatReq}`,
    () => COMBAT_STATS.every((stat) => currentSkills[stat] >= combatReq),
    { requirement: combatReq, ownTime: () => trainingTime },
  );

export const killsGoal = (killsRequired: number, numPeopleKilled: number) =>
  goal(
    'KILLS',
    `Kill ${killsRequired} people`,
    () => numPeopleKilled >= killsRequired,
    {
      requirement: numPeopleKilled,
      ownTime: () => (killsRequired - numPeopleKilled) * 3,
    },
  );

export const karmaGoal = (karmaRequired: number, karma: number) =>
  goal('KARMA', `Have ${karmaRequired} karma`, () => karmaRequired >= karma, {
    requirement: karmaRequired,
    ownTime: () => -(karmaRequired - karma),
  });

export const moneyPrereqGoal = (
  moneyTarget: number,
  currentMoney: number,
  referenceIncome: number,
) =>
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

export const locationGoal = (location: CityName, currentLocation: CityName) =>
  goal('LOCATION', 'Visit ' + location, () => currentLocation === location, {
    requirement: location,
    ownTime: () => 0,
  });

export const factionJoinGoal = (
  faction: FactionName,
  factions: FactionName[],
  deps: Goal[] = [],
) =>
  goal('FACTION_JOIN', 'Join ' + faction, () => factions.includes(faction), {
    faction,
    deps,
    ownTime: () => 0,
  });

export const factionRepGoal = (
  faction: FactionName,
  requirement: number,
  currentRep: number,
  dep: Goal,
  repRate?: number,
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

export const augMoneyGoal = (
  costToAug: number | undefined,
  liquidAssets: number,
  referenceIncome: number,
) =>
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

export const augmentationGoal = (
  aug: string,
  faction: FactionName,
  purchasedAugmentations: string[],
  deps: Goal[],
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
 */
export const neurofluxGoal = (
  ordinal: number,
  faction: FactionName,
  purchasedAugmentations: string[],
  deps: Goal[],
  value = 0,
) =>
  goal(
    'AUGMENTATION',
    NEUROFLUX,
    () =>
      purchasedAugmentations.filter((a) => a === NEUROFLUX).length >= ordinal,
    { faction, deps, value, ownTime: () => 0 },
  );

export const factionFavorGoal = (
  faction: FactionName,
  neededRep: number,
  currentRep: number,
  repRate: number,
  dep: Goal,
) => {
  const remaining = Math.max(0, neededRep - currentRep);
  return goal(
    'FACTION_FAVOR',
    `${neededRep} rep for favor (${faction})`,
    () => currentRep >= neededRep,
    {
      requirement: neededRep,
      faction,
      deps: [dep],
      ownTime: () => (repRate > 0 ? remaining / repRate : null),
    },
  );
};

export const buyRepGoal = (
  faction: FactionName,
  repRequired: number,
  currentRep: number,
  deps: Goal[],
) =>
  goal(
    'BUY_REP',
    `Buy ${fmtRep(repRequired)} rep (${faction})`,
    () => currentRep >= repRequired,
    { faction, deps, requirement: repRequired - currentRep, ownTime: () => 0 },
  );

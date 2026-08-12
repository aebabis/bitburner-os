import { C } from '../colors.ts';

const fmt = new Intl.NumberFormat('en', { notation: 'compact' });
const fmtMoney = (n: number) => '$' + fmt.format(n);

export type GoalType =
  | 'JOB_RAM'
  | 'HOME_RAM'
  | 'INSTALL'
  | 'REBOOT'
  | 'REEVALUATE'
  | 'FACTION_JOIN'
  | 'FACTION_REP'
  | 'FACTION_FAVOR'
  | 'BLADES_JOIN'
  | 'LABYRINTH'
  | 'COMBAT_LEVEL'
  | 'HACKNET'
  | 'HACKING_LEVEL'
  | 'HACKING_XP'
  | 'KILLS'
  | 'KARMA'
  | 'LOCATION'
  | 'FINISH_GRAFTING'
  | 'MONEY'
  | 'AUG_MONEY'
  | 'HORIZON'
  | 'EITHER'
  | 'MUTEX'
  | 'WAIT'
  | 'NEVER';

export type Action =
  | { type: 'BUY_REP'; faction: FactionName; amount: number }
  | { type: 'BUY_AUG'; name: string };

type GoalCommon<T extends GoalType> = {
  type: T;
  desc: string;
  isDone: () => boolean;
  toString: () => string;
  deps: Goal[];
  actions: Action[];
  ownTime: () => number;
  timeToComplete: () => number;
  prerequisites: {
    (): Goal[];
    <U extends GoalType>(typeFilter: U): GoalOfType<U>[];
  };
};

// Goal types whose only extra data is a numeric target.
type NumericRequirementType =
  | 'HACKING_LEVEL'
  | 'HACKING_XP'
  | 'KILLS'
  | 'KARMA'
  | 'MONEY'
  | 'AUG_MONEY';

type PlainGoalType = Exclude<
  GoalType,
  | NumericRequirementType
  | 'LOCATION'
  | 'FACTION_REP'
  | 'FACTION_FAVOR'
  | 'FACTION_JOIN'
  | 'COMBAT_LEVEL'
>;

// Distributes over T so each literal in a multi-member group (e.g. NumericRequirementType)
// becomes its own discriminated union member instead of one member with a union-valued `type`
// — required for `Extract<Goal, { type: T }>` (see GoalOfType) to resolve per literal.
type Distribute<T extends GoalType, Extra> = T extends GoalType ? GoalCommon<T> & Extra : never;

type HacknetStat = 'hacknetLevels' | 'hacknetRAM' | 'hacknetCores';

export type Goal =
  | Distribute<PlainGoalType, unknown>
  | Distribute<NumericRequirementType, { requirement: number }>
  | Distribute<'LOCATION', { city: CityName }>
  | Distribute<'FACTION_REP' | 'FACTION_FAVOR', { requirement: number; faction: FactionName }>
  | Distribute<'FACTION_JOIN', { faction: FactionName }>
  | Distribute<'COMBAT_LEVEL', { requirement: number; stat: CombatStat }>
  | Distribute<'HACKNET', { requirement: number; stat: HacknetStat }>;

export type GoalOfType<T extends GoalType> = Extract<Goal, { type: T }>;

export type Plan = Goal & { utility: (overhead: number) => number };

export const COMBAT_STATS = ['strength', 'defense', 'dexterity', 'agility'] as const;
export type CombatStat = (typeof COMBAT_STATS)[number];
export const NEUROFLUX = 'NeuroFlux Governor';

const assertFinitePositive = (n: number, name: string) => {
  if (n <= 0 || Number.isNaN(n) || !Number.isFinite(n))
    throw new Error(name + ' must be positive. Got: ' + n);
};

interface GoalProps {
  deps?: Goal[];
  actions?: Action[];
  ownTime?: () => number;
}
const goal = <T extends GoalType>(
  type: T,
  desc: string,
  isDone: () => boolean,
  { deps = [], actions = [], ownTime = () => 0 }: GoalProps = {},
): GoalCommon<T> => {
  let _ttc: number;
  const prerequisites = ((typeFilter?: GoalType) => {
    const seen = new Set<Goal>();
    const result: Goal[] = [];
    const walk = (goalDeps: Goal[]) => {
      for (const dep of goalDeps) {
        if (seen.has(dep)) continue;
        seen.add(dep);
        if (typeFilter == null || dep.type === typeFilter) result.push(dep);
        walk(dep.deps);
      }
    };
    walk(deps);
    return result;
  }) as GoalCommon<T>['prerequisites'];
  return {
    type,
    desc,
    isDone,
    deps,
    actions,
    ownTime,
    toString: () => (isDone() ? desc : C(56)(desc)),
    prerequisites,
    timeToComplete() {
      if (_ttc !== undefined) return _ttc;
      if (isDone()) return (_ttc = 0);
      const depsMax = deps.length === 0 ? 0 : Math.max(...deps.map((d) => d.timeToComplete()));
      const own = ownTime();
      return (_ttc = depsMax + own);
    },
  };
};

export const homeRamGoal = (currentRam: number, targetRam: number, prereq: Goal) =>
  goal('HOME_RAM', `${targetRam}GB RAM on home`, () => currentRam >= targetRam, {
    deps: [prereq],
    ownTime: () => 0,
  });

export const installGoal = (deps: Goal[], actions: Action[]) => {
  const isInstall = actions.find((action) => action.type === 'BUY_AUG');
  const desc = isInstall ? 'Install augmentations' : 'Reset for favor';
  return goal('INSTALL', desc, () => false, {
    deps,
    actions,
    ownTime: () => 0,
  });
};

export const rebootGoal = (dep: Goal) =>
  goal('REBOOT', 'Reboot', () => false, {
    deps: [dep],
    ownTime: () => 0,
  });

/**
 * Root goal for non-SF4 runs (eg BN1.1). Represents a fixed horizon,
 * allowing services concerned with time-to-install to behave reasonably.
 */
export const horizonGoal = (horizonSeconds: number, deps: Goal[] = []) =>
  goal('HORIZON', `No plan (${Math.round(horizonSeconds / 60)}m horizon)`, () => false, {
    deps,
    ownTime: () => horizonSeconds,
  });

export const reevaluateGoal = (dep: Goal) =>
  goal('REEVALUATE', 'Re-evaluate plan', () => false, {
    deps: [dep],
    ownTime: () => 0,
  });

export const hackingLevelGoal = (
  hackReq: number,
  currentHacking: number,
  trainingTime: number,
  deps: Goal[] = [],
) => ({
  ...goal('HACKING_LEVEL', `Hacking ≥ ${Math.ceil(hackReq)}`, () => currentHacking >= hackReq, {
    deps,
    ownTime: () => trainingTime,
  }),
  requirement: hackReq,
});

export const hackingXpGoal = (xpReq: number, currentXp: number, trainingTime: number) => ({
  ...goal('HACKING_XP', `Hacking XP ≥ ${Math.ceil(xpReq)}`, () => currentXp >= xpReq, {
    ownTime: () => trainingTime,
  }),
  requirement: xpReq,
});

export const combatLevelsGoal = (
  combatReq: number,
  stat: CombatStat,
  currentSkills: Skills,
  trainingTime: number,
  /** Goal without Stanek multiplier. Matches `combatReq` when modifier is 1 **/
  baseReq: number = combatReq,
) => {
  const req = Math.ceil(combatReq);
  const name = `${stat[0].toUpperCase()}${stat.slice(1)}`;
  const desc = req === baseReq ? `${name} ≥ ${req}` : `${name} ≥ ${req} (${baseReq} base)`;
  return {
    ...goal('COMBAT_LEVEL', desc, () => currentSkills[stat] >= req, {
      ownTime: () => trainingTime,
    }),
    requirement: req,
    stat,
  };
};

export const killsGoal = (killsRequired: number, numPeopleKilled: number, deps: Goal[] = []) => ({
  ...goal('KILLS', `Kill ${killsRequired} people`, () => numPeopleKilled >= killsRequired, {
    deps,
    ownTime: () => (killsRequired - numPeopleKilled) * 3,
  }),
  requirement: killsRequired,
});

export const karmaGoal = (karmaRequired: number, karma: number, deps: Goal[] = []) => ({
  ...goal('KARMA', `Have ${karmaRequired} karma`, () => karmaRequired >= karma, {
    deps,
    ownTime: () => -(karmaRequired - karma),
  }),
  requirement: karmaRequired,
});

export const moneyPrereqGoal = (moneyTarget: number, currentMoney: number, totalIncome: number) => {
  assertFinitePositive(totalIncome, 'totalIncome');
  return {
    ...goal('MONEY', `Have ${fmtMoney(moneyTarget)}`, () => currentMoney >= moneyTarget, {
      ownTime: () => Math.max(0, moneyTarget - currentMoney) / totalIncome,
    }),
    requirement: moneyTarget,
  };
};

export const locationGoal = (location: CityName, currentLocation: CityName, deps: Goal[] = []) => ({
  ...goal('LOCATION', 'Visit ' + location, () => currentLocation === location, {
    deps,
    ownTime: () => 0,
  }),
  city: location,
});

/**
 * Represents in-progress graft. Blocks all goals that require player action.
 */
export const finishGraftingGoal = (augmentation: string, timeLeft: number) =>
  goal('FINISH_GRAFTING', `Finish grafting ${augmentation}`, () => timeLeft <= 0, {
    ownTime: () => Math.max(0, timeLeft),
  });

export const factionJoinGoal = (
  faction: FactionName,
  factions: FactionName[],
  deps: Goal[] = [],
) => ({
  ...goal('FACTION_JOIN', 'Join ' + faction, () => factions.includes(faction), {
    deps,
    ownTime: () => 0,
  }),
  faction,
});

export const bladesJoinGoal = (inBlades: boolean, deps: Goal[] = []) =>
  goal('BLADES_JOIN', 'Join the Bladeburner Division', () => inBlades, {
    deps,
    ownTime: () => 0,
  });

export const factionRepGoal = (
  faction: FactionName,
  requirement: number,
  currentRep: number,
  dep: Goal,
  repRate: number,
  deps: Goal[] = [],
) => {
  assertFinitePositive(repRate, 'repRate');
  return {
    ...goal(
      'FACTION_REP',
      `Gain ${Math.round(requirement)} rep (${faction})`,
      () => currentRep >= requirement,
      {
        deps: [dep, ...deps],
        ownTime: () => Math.max(0, requirement - currentRep) / repRate,
      },
    ),
    requirement,
    faction,
  };
};

export const augMoneyGoal = (costToAug: number, liquidAssets: number, totalIncome: number) => {
  assertFinitePositive(totalIncome, 'totalIncome');
  return {
    ...goal(
      'AUG_MONEY',
      'Save ' + fmtMoney(costToAug) + ' for augmentations',
      () => liquidAssets >= costToAug,
      {
        ownTime: () => Math.max(0, costToAug - liquidAssets) / totalIncome,
      },
    ),
    requirement: costToAug,
  };
};

export const buyAugAction = (name: string): Action => ({
  type: 'BUY_AUG',
  name,
});

export const buyRepAction = (faction: FactionName, amount: number): Action => ({
  type: 'BUY_REP',
  faction,
  amount,
});

export const factionFavorGoal = (
  faction: FactionName,
  neededRep: number,
  currentRep: number,
  repRate: number,
  dep: Goal,
  deps: Goal[] = [],
) => {
  assertFinitePositive(repRate, 'repRate');
  const remaining = Math.max(0, neededRep - currentRep);
  return {
    ...goal(
      'FACTION_FAVOR',
      `${Math.round(neededRep)} rep for favor (${faction})`,
      () => currentRep >= neededRep,
      {
        deps: [dep, ...deps],
        ownTime: () => remaining / repRate,
      },
    ),
    requirement: neededRep,
    faction,
  };
};

// Disjunction: satisfied once any branch is satisfied. Unlike deps (AND, aggregated
// via max), estimated time is the min across branches since only one need complete.
export const eitherGoal = (branches: Goal[]) => {
  const base = goal(
    'EITHER',
    branches.map((b) => b.desc).join(' OR '),
    () => branches.some((b) => b.isDone()),
    { deps: branches, ownTime: () => 0 },
  );
  let _ttc: number;
  return {
    ...base,
    timeToComplete: (): number => {
      if (_ttc != null) return _ttc;
      return (_ttc = Math.min(...branches.map((b) => b.timeToComplete())));
    },
  };
};

// Conjunction where parts contend for the same actor and so can't progress in parallel
// (e.g. training all four combat stats — only one can be trained at a time; order doesn't
// matter). Satisfied once every part is satisfied; unlike the default AND aggregation (max of
// deps' times, which assumes parts progress concurrently), estimated time is the sum across
// parts.
export const mutexGoal = (
  parts: Goal[],
  desc = parts.map((p) => p.desc).join(' & '),
  deps: Goal[] = [], // Dependencies shared by multiple parts. Time is counted only once
) => {
  const isDone = () => parts.every((p) => p.isDone());
  const base = goal('MUTEX', desc, isDone, {
    deps: [...deps, ...parts],
    ownTime: () => 0,
  });
  let _ttc: number;
  return {
    ...base,
    timeToComplete: (): number => {
      if (_ttc !== undefined) return _ttc;
      if (isDone()) return (_ttc = 0);
      const depsMax = deps.length === 0 ? 0 : Math.max(...deps.map((d) => d.timeToComplete()));
      const partsSum = parts.map((p) => p.timeToComplete()).reduce((a, b) => a + b, 0);
      return (_ttc = depsMax + partsSum);
    },
  };
};

export const hacknetGoal = (
  stat: HacknetStat,
  requirement: number,
  current: number,
  cost: number,
  income: number,
) => {
  assertFinitePositive(income, 'income');
  return {
    ...goal('HACKNET', `${requirement} hacknet ${stat}`, () => current >= requirement, {
      ownTime: () => {
        if (current >= requirement) return 0;
        return cost / income;
      },
    }),
    requirement,
    stat,
  };
};

export const labyrinthGoal = (labyAugsHeld: number) => {
  return goal('LABYRINTH', 'Acquire labyrinth aug #' + (labyAugsHeld + 1), () => false, {
    // Estimated time to traverse maze. True value varies a lot, but in BN15, the priority
    // is to favor the maze once the player is in it.
    // TODO: Make mole.ts estimate actual time remaining.
    ownTime: () => 5 * 60,
  });
};

// Placeholder goal representing transient lack of information. Defaults to short time
// value as most derived information used by goal engine becomes available shortly after boot.
export const waitGoal = (desc = 'Wait for data', time = 10, deps: Goal[] = []) => {
  return goal('WAIT', desc, () => false, { ownTime: () => time, deps });
};

// Sentinel time for a goal that will never be met and therefore must never be chosen.
// Uses MAX_SAFE_INTEGER instead of Infinity so that numeric calcuations never create NaN.
export const NEVER = Number.MAX_SAFE_INTEGER;

// Represents goal that can never be met because it includes a requirement prohibited
// by the player's current circumstances (e.g. requires a services that needs Formulas.exe
// when the player doesn't have it).
// Large time ensures it will never be chosen by goal engine if another option exists.
export const neverGoal = () => {
  return goal('NEVER', 'Wait forever', () => false, { ownTime: () => NEVER });
};

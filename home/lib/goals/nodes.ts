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
  | 'COMBAT_LEVELS'
  | 'HACKING_LEVEL'
  | 'HACKING_XP'
  | 'KILLS'
  | 'KARMA'
  | 'LOCATION'
  | 'MONEY'
  | 'AUG_MONEY'
  | 'EITHER'
  | 'MUTEX';

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
  ownTime: () => number | null;
  timeToComplete: () => number | null;
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
  | 'COMBAT_LEVELS'
>;

// Distributes over T so each literal in a multi-member group (e.g. NumericRequirementType)
// becomes its own discriminated union member instead of one member with a union-valued `type`
// — required for `Extract<Goal, { type: T }>` (see GoalOfType) to resolve per literal.
type Distribute<T extends GoalType, Extra> = T extends GoalType ? GoalCommon<T> & Extra : never;

export type Goal =
  | Distribute<PlainGoalType, unknown>
  | Distribute<NumericRequirementType, { requirement: number }>
  | Distribute<'LOCATION', { city: CityName }>
  | Distribute<'FACTION_REP' | 'FACTION_FAVOR', { requirement: number; faction: FactionName }>
  | Distribute<'FACTION_JOIN', { faction: FactionName }>
  | Distribute<'COMBAT_LEVELS', { requirement: number; stat: CombatStat }>;

export type GoalOfType<T extends GoalType> = Extract<Goal, { type: T }>;

export type Plan = Goal & { utility: (overhead: number) => number };

export const COMBAT_STATS = ['strength', 'defense', 'dexterity', 'agility'] as const;
export type CombatStat = (typeof COMBAT_STATS)[number];
export const NEUROFLUX = 'NeuroFlux Governor';

interface GoalProps {
  deps?: Goal[];
  actions?: Action[];
  ownTime?: () => number | null;
}
const goal = <T extends GoalType>(
  type: T,
  desc: string,
  isDone: () => boolean,
  { deps = [], actions = [], ownTime = () => null }: GoalProps = {},
): GoalCommon<T> => {
  let _ttc: number | null;
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
      const depsMax =
        deps.length === 0 ? 0 : Math.max(...deps.map((d) => d.timeToComplete() ?? Infinity));
      const own = ownTime();
      return (_ttc = depsMax === Infinity || own == null ? null : depsMax + own);
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

export const reevaluateGoal = (dep: Goal) =>
  goal('REEVALUATE', 'Re-evaluate plan', () => false, {
    deps: [dep],
    ownTime: () => 0,
  });

export const hackingLevelGoal = (
  hackReq: number,
  currentHacking: number,
  trainingTime: number | null = null,
) => ({
  ...goal('HACKING_LEVEL', `Hacking ≥ ${Math.ceil(hackReq)}`, () => currentHacking >= hackReq, {
    ownTime: () => trainingTime,
  }),
  requirement: hackReq,
});

export const hackingXpGoal = (
  xpReq: number,
  currentXp: number,
  trainingTime: number | null = null,
) => ({
  ...goal('HACKING_XP', `Hacking XP ≥ ${xpReq}`, () => currentXp >= xpReq, {
    ownTime: () => trainingTime,
  }),
  requirement: xpReq,
});

export const combatLevelsGoal = (
  combatReq: number,
  stat: CombatStat,
  currentSkills: Skills,
  trainingTime: number | null = null,
  /** Goal without Stanek multiplier. Matches `combatReq` when modifier is 1 **/
  baseReq: number = combatReq,
) => {
  const req = Math.ceil(combatReq);
  const name = `${stat[0].toUpperCase()}${stat.slice(1)}`;
  const desc = req === baseReq ? `${name} ≥ ${req}` : `${name} ≥ ${req} (${baseReq} base)`;
  return {
    ...goal('COMBAT_LEVELS', desc, () => currentSkills[stat] >= req, {
      ownTime: () => trainingTime,
    }),
    requirement: req,
    stat,
  };
};

export const killsGoal = (killsRequired: number, numPeopleKilled: number) => ({
  ...goal('KILLS', `Kill ${killsRequired} people`, () => numPeopleKilled >= killsRequired, {
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

export const moneyPrereqGoal = (
  moneyTarget: number,
  currentMoney: number,
  totalIncome: number,
) => ({
  ...goal('MONEY', `Have ${fmtMoney(moneyTarget)}`, () => currentMoney >= moneyTarget, {
    ownTime: () => (totalIncome > 0 ? Math.max(0, moneyTarget - currentMoney) / totalIncome : null),
  }),
  requirement: moneyTarget,
});

export const locationGoal = (location: CityName, currentLocation: CityName) => ({
  ...goal('LOCATION', 'Visit ' + location, () => currentLocation === location, {
    ownTime: () => 0,
  }),
  city: location,
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
  goal('BLADES_JOIN', 'Join the blades', () => inBlades, {
    deps,
    ownTime: () => 0,
  });

export const factionRepGoal = (
  faction: FactionName,
  requirement: number,
  currentRep: number,
  dep: Goal,
  repRate = 0,
) => ({
  ...goal('FACTION_REP', `Gain ${requirement} rep (${faction})`, () => currentRep >= requirement, {
    deps: [dep],
    ownTime: () => (repRate > 0 ? Math.max(0, requirement - currentRep) / repRate : null),
  }),
  requirement,
  faction,
});

export const augMoneyGoal = (costToAug: number, liquidAssets: number, totalIncome: number) => ({
  ...goal(
    'AUG_MONEY',
    'Save ' + fmtMoney(costToAug) + ' for augmentations',
    () => liquidAssets >= costToAug,
    {
      ownTime: () => (totalIncome > 0 ? Math.max(0, costToAug - liquidAssets) / totalIncome : null),
    },
  ),
  requirement: costToAug,
});

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
) => {
  const remaining = Math.max(0, neededRep - currentRep);
  return {
    ...goal(
      'FACTION_FAVOR',
      `${neededRep} rep for favor (${faction})`,
      () => currentRep >= neededRep,
      {
        deps: [dep],
        ownTime: () => (repRate > 0 ? remaining / repRate : null),
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
  let _ttc: number | null | undefined;
  return {
    ...base,
    timeToComplete: (): number | null => {
      if (_ttc !== undefined) return _ttc;
      const times = branches.map((b) => b.timeToComplete()).filter((t): t is number => t != null);
      return (_ttc = times.length > 0 ? Math.min(...times) : null);
    },
  };
};

// Conjunction where parts contend for the same actor and so can't progress in parallel
// (e.g. training all four combat stats — only one can be trained at a time; order doesn't
// matter). Satisfied once every part is satisfied; unlike the default AND aggregation (max of
// deps' times, which assumes parts progress concurrently), estimated time is the sum across
// parts.
export const mutexGoal = (parts: Goal[], desc = parts.map((p) => p.desc).join(' & ')) => {
  const base = goal('MUTEX', desc, () => parts.every((p) => p.isDone()), {
    deps: parts,
    ownTime: () => 0,
  });
  let _ttc: number | null | undefined;
  return {
    ...base,
    timeToComplete: (): number | null => {
      if (_ttc !== undefined) return _ttc;
      const times = parts.map((p) => p.timeToComplete());
      return (_ttc = times.some((t) => t == null)
        ? null
        : (times as number[]).reduce((a, b) => a + b, 0));
    },
  };
};

export const labyrinthGoal = (labyAugsHeld: number) => {
  return goal('LABYRINTH', 'Acquire labyrinth aug #' + (labyAugsHeld + 1), () => false);
};

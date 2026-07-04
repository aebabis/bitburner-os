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
  | 'AUG_MONEY';

export type Action =
  | { type: 'BUY_REP'; faction: FactionName; amount: number }
  | { type: 'BUY_AUG'; name: string };

export type Plan = Goal & { utility: (overhead: number) => number };

export type Goal = {
  type: GoalType;
  desc: string;
  isDone: () => boolean;
  toString: () => string;
  requirement: number | CityName | undefined;
  faction: FactionName | undefined;
  deps: Goal[];
  actions: Action[];
  ownTime: () => number | null;
  timeToComplete: () => number | null;
  prerequisites: (typeFilter?: GoalType) => Goal[];
};

export const COMBAT_STATS = ['strength', 'defense', 'dexterity', 'agility'] as const;
export const NEUROFLUX = 'NeuroFlux Governor';

interface GoalProps {
  requirement?: number | CityName;
  faction?: FactionName;
  deps?: Goal[];
  actions?: Action[];
  ownTime?: () => number | null;
}
export const goal = (
  type: GoalType,
  desc: string,
  isDone: () => boolean,
  { requirement, faction, deps = [], actions = [], ownTime = () => null }: GoalProps = {},
): Goal => {
  let _ttc: number | null;
  return {
    type,
    desc,
    isDone,
    requirement,
    faction,
    deps,
    actions,
    ownTime,
    toString: () => (isDone() ? desc : C(56)(desc)),
    prerequisites(typeFilter?: GoalType): Goal[] {
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
    },
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
) =>
  goal('HACKING_LEVEL', `Hacking ≥ ${hackReq}`, () => currentHacking >= hackReq, {
    requirement: hackReq,
    ownTime: () => trainingTime,
  });

export const hackingXpGoal = (
  xpReq: number,
  currentXp: number,
  trainingTime: number | null = null,
) =>
  goal('HACKING_XP', `Hacking XP ≥ ${xpReq}`, () => currentXp >= xpReq, {
    requirement: xpReq,
    ownTime: () => trainingTime,
  });

export const combatLevelsGoal = (
  combatReq: number,
  currentSkills: Skills,
  trainingTime: number | null = null,
) =>
  goal(
    'COMBAT_LEVELS',
    `Combat stats ≥ ${combatReq}`,
    () => COMBAT_STATS.every((stat) => currentSkills[stat] >= combatReq),
    { requirement: combatReq, ownTime: () => trainingTime },
  );

export const killsGoal = (killsRequired: number, numPeopleKilled: number) =>
  goal('KILLS', `Kill ${killsRequired} people`, () => numPeopleKilled >= killsRequired, {
    requirement: numPeopleKilled,
    ownTime: () => (killsRequired - numPeopleKilled) * 3,
  });

export const karmaGoal = (karmaRequired: number, karma: number, deps: Goal[] = []) =>
  goal('KARMA', `Have ${karmaRequired} karma`, () => karmaRequired >= karma, {
    deps,
    requirement: karmaRequired,
    ownTime: () => -(karmaRequired - karma),
  });

export const moneyPrereqGoal = (moneyTarget: number, currentMoney: number, totalIncome: number) =>
  goal('MONEY', `Have ${fmtMoney(moneyTarget)}`, () => currentMoney >= moneyTarget, {
    requirement: moneyTarget,
    ownTime: () => (totalIncome > 0 ? Math.max(0, moneyTarget - currentMoney) / totalIncome : null),
  });

export const locationGoal = (location: CityName, currentLocation: CityName) =>
  goal('LOCATION', 'Visit ' + location, () => currentLocation === location, {
    requirement: location,
    ownTime: () => 0,
  });

export const factionJoinGoal = (faction: FactionName, factions: FactionName[], deps: Goal[] = []) =>
  goal('FACTION_JOIN', 'Join ' + faction, () => factions.includes(faction), {
    faction,
    deps,
    ownTime: () => 0,
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
) =>
  goal('FACTION_REP', `Gain ${requirement} rep (${faction})`, () => currentRep >= requirement, {
    requirement,
    faction,
    deps: [dep],
    ownTime: () => (repRate > 0 ? Math.max(0, requirement - currentRep) / repRate : null),
  });

export const augMoneyGoal = (
  costToAug: number | undefined,
  liquidAssets: number,
  totalIncome: number,
) =>
  goal(
    'AUG_MONEY',
    'Save ' + (costToAug != null ? fmtMoney(costToAug) : '?') + ' for augmentations',
    () => costToAug != null && liquidAssets >= costToAug,
    {
      requirement: costToAug,
      ownTime: () =>
        costToAug != null && totalIncome > 0
          ? Math.max(0, costToAug - liquidAssets) / totalIncome
          : null,
    },
  );

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

export const labyrinthGoal = (labyAugsHeld: number) => {
  return goal('LABYRINTH', 'Acquire labyrinth aug #' + (labyAugsHeld + 1), () => false);
};

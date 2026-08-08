import { getStaticData, hasSingularityData, type SF4StaticData } from '../lib/data-store';
import { getGoals } from '../lib/goals/goals';
import { COMBAT_STATS, CombatStat } from '../lib/goals/nodes';
import { inPlace, runInPlace } from '../lib/in-place';
import { table } from '../lib/table';
import { formatTime } from '../lib/util';

type SleeveTaskInfo = Exclude<SleeveTask, 'nextCompletion'>;
type SleeveInfo = {
  num: number;
  sleeve: SleevePerson;
  currentTask: SleeveTaskInfo;
};

const GANG_KARMA = -54000;

type MurderState = {
  t: number;
  sleeve: SleevePerson;
  numSleeves: number;
  karma: number;
};

type SleeveKarmaAction = 'recover' | 'murder' | 'str' | 'def' | 'dex' | 'agi';

type Verdict = {
  action: SleeveKarmaAction;
  timeToGang: number; // Upper bound
};

const STATS = {
  str: { expField: 'strExp', exp: 'strength_exp', weight: 'strength_success_weight' },
  def: { expField: 'defExp', exp: 'defense_exp', weight: 'defense_success_weight' },
  dex: { expField: 'dexExp', exp: 'dexterity_exp', weight: 'dexterity_success_weight' },
  agi: { expField: 'agiExp', exp: 'agility_exp', weight: 'agility_success_weight' },
} as const;

// Assumptions:
// - Sleeves move in lockstep; all sleeves have the same skills, exp, and shock
const murderSolver = (ns: NS, staticData: SF4StaticData) => {
  const GYM_STATS = Object.keys(ns.enums.GymType) as (keyof GymEnumType)[];
  const PASSIVE_RECOVERY = 0.0005;
  const ACTIVE_RECOVERY = 3 * PASSIVE_RECOVERY;
  const {
    CrimeSuccessRate = 1,
    CrimeExpGain = 1,
    StrengthLevelMultiplier = 1,
    DefenseLevelMultiplier = 1,
    DexterityLevelMultiplier = 1,
    AgilityLevelMultiplier = 1,
  } = staticData.bitNodeMultipliers || {};
  const { Homicide: murder } = staticData.singularityData.crimeStats;
  const MURDER_TIME = murder.time / 1000;
  const MURDER_KARMA_RATE = -murder.karma / MURDER_TIME;

  const BN_LEVEL_MULTS = {
    strength: StrengthLevelMultiplier,
    defense: DefenseLevelMultiplier,
    dexterity: DexterityLevelMultiplier,
    agility: AgilityLevelMultiplier,
  } as const;

  const getMurderChance = (sleeve: Person) =>
    Math.min(
      1,
      (sleeve.mults.crime_success *
        CrimeSuccessRate *
        (sleeve.skills.strength * murder[STATS.str.weight] +
          sleeve.skills.defense * murder[STATS.def.weight] +
          sleeve.skills.dexterity * murder[STATS.dex.weight] +
          sleeve.skills.agility * murder[STATS.agi.weight])) /
        975,
    );

  const fractionalLevel = (exp: number, mult: number) => {
    const level = ns.formulas.skills.calculateSkill(exp, mult);
    const levelExp = ns.formulas.skills.calculateExp(level, mult);
    const nextLevelExp = ns.formulas.skills.calculateExp(level + 1, mult);
    return level + (exp - levelExp) / (nextLevelExp - levelExp);
  };

  const murderResult = (
    { sleeve, karma, t, numSleeves }: MurderState,
    playerKarmaRate: number,
    numSeconds: number,
  ) => {
    const p = getMurderChance(sleeve);
    const S = (100 - sleeve.shock) / 100;
    const sleeveExpMult = CrimeExpGain * (0.25 + 0.75 * p) * S;
    const totalExpMult = sleeveExpMult + sleeveExpMult * S * (numSleeves - 1);
    const numAttempts = numSeconds / MURDER_TIME;
    const exp = {
      ...sleeve.exp,
      ...COMBAT_STATS.reduce(
        (stats, statName) => {
          const expName = STATS[ns.enums.GymType[statName]].exp;
          const newExp = totalExpMult * sleeve.mults[expName] * numAttempts * murder[expName];
          stats[statName] = sleeve.exp[statName] + newExp;
          return stats;
        },
        {} as Record<CombatStat, number>,
      ),
    };
    const skills = {
      ...sleeve.skills,
      ...COMBAT_STATS.reduce(
        (stats, statName) => {
          // Use fractional level so that small time slices
          // still capture the value of levelling
          const mult = sleeve.mults[statName] * BN_LEVEL_MULTS[statName];
          stats[statName] = fractionalLevel(exp[statName], mult);
          return stats;
        },
        {} as Record<CombatStat, number>,
      ),
    };
    return {
      sleeve: {
        ...sleeve,
        exp,
        skills,
        shock: Math.max(0, sleeve.shock - PASSIVE_RECOVERY * numSeconds),
      },
      karma: karma + (p * MURDER_KARMA_RATE * numSleeves + playerKarmaRate) * numSeconds,
      t: t + numSeconds,
      numSleeves,
    };
  };

  const MAX_ITERS = 1000;
  // Estimates time to get target karma with given stats for sleeves
  // if all of them were to murder now.
  const getMurderTimeToGang = (murderState: MurderState, playerKarmaRate: number) => {
    let currentState = murderState;
    for (let i = 0; i < MAX_ITERS && currentState.karma > GANG_KARMA; i++) {
      const murderRate =
        MURDER_KARMA_RATE * getMurderChance(currentState.sleeve) * murderState.numSleeves +
        playerKarmaRate;
      const estTimeRemaining = (GANG_KARMA - currentState.karma) / murderRate;
      const dt = estTimeRemaining / (MAX_ITERS - i);
      currentState = murderResult(currentState, playerKarmaRate, dt);
    }
    return currentState.t;
  };

  const gymResult = ({ sleeve, karma, t, numSleeves }: MurderState, playerKarmaRate: number) => {
    // Determine skill to train based on exp formula and skill chance contributions.
    // Return result of training a single level for all sleeves.
    // Effects of PASSIVE_RECOVERY are ignored here, as they are insignificant
    // for the involved S (shock multiplier) and t (time) values.
    const { dt, stat, statName, nextLevel, nextLevelExp } = GYM_STATS.map((statName) => {
      const stat = ns.enums.GymType[statName];
      const baseGain =
        5 * ns.formulas.work.gymGains(sleeve, stat, 'Powerhouse Gym')[STATS[stat].expField];
      const nextLevel = sleeve.skills[statName] + 1;
      const currentExp = sleeve.exp[statName];
      const mult = sleeve.mults[statName] * BN_LEVEL_MULTS[statName];
      const nextLevelExp = ns.formulas.skills.calculateExp(nextLevel, mult);
      const S = 1 - sleeve.shock / 100;
      const sleeveExpGain = S * baseGain;
      const totalExpGain = sleeveExpGain + (numSleeves - 1) * S * sleeveExpGain;
      const dt = (nextLevelExp - currentExp) / totalExpGain;
      const weightedT = dt / murder[STATS[stat].weight];
      return { stat, statName, dt, weightedT, nextLevel, nextLevelExp };
    }).reduce((a, b) => (a.weightedT < b.weightedT ? a : b));

    return {
      stat,
      state: {
        t: t + dt,
        sleeve: {
          ...sleeve,
          skills: { ...sleeve.skills, [statName]: nextLevel },
          exp: { ...sleeve.exp, [statName]: nextLevelExp },
          shock: Math.max(0, sleeve.shock - PASSIVE_RECOVERY * dt),
        },
        karma: karma + playerKarmaRate * dt,
        numSleeves,
      } as MurderState,
    };
  };

  const RECOVER_TIME = 1; // Reference time spent for recovering. Increase if deltas too small
  const recoveryResult = (
    { sleeve, numSleeves, karma, t }: MurderState,
    playerKarmaRate: number,
  ): MurderState => ({
    t: t + RECOVER_TIME,
    sleeve: {
      ...sleeve,
      shock: Math.max(0, sleeve.shock - ACTIVE_RECOVERY * RECOVER_TIME),
    },
    karma: karma + playerKarmaRate * RECOVER_TIME,
    numSleeves,
  });

  return (startState: MurderState, playerKarmaRate: number): Verdict => {
    const immediateMurderTime = getMurderTimeToGang(startState, playerKarmaRate);
    if (getMurderChance(startState.sleeve) > 0.99)
      return { action: 'murder', timeToGang: immediateMurderTime };

    const recoveredState = recoveryResult(startState, playerKarmaRate);
    const recoveredMurderTime = getMurderTimeToGang(recoveredState, playerKarmaRate);

    // if one more tick of recovery is a marginal improvement on time to gang,
    // stop searching and keep recovering
    if (recoveredMurderTime < immediateMurderTime)
      return { action: 'recover', timeToGang: recoveredMurderTime };

    const { stat, state: trainedState } = gymResult(startState, playerKarmaRate);
    const trainedMurderTime = getMurderTimeToGang(trainedState, playerKarmaRate);
    if (trainedMurderTime < immediateMurderTime)
      return { action: stat, timeToGang: trainedMurderTime };
    else return { action: 'murder', timeToGang: immediateMurderTime };
  };
};

export async function main(ns: NS) {
  const GYM_STATS = Object.keys(ns.enums.GymType) as (keyof GymEnumType)[];
  const $ = inPlace(ns, ns.pid);
  const $rip = runInPlace(ns, ns.pid);

  const staticData = getStaticData(ns);
  if (!hasSingularityData(staticData)) {
    // Without the ability to get player work,
    // or compute the value of crimes, doing Homicide
    // is a simple fallback. Should not happen in practice,
    // as SF4 is pursued early.
    const numSleeves = await $.sleeve['getNumSleeves']();
    for (let i = 0; i < numSleeves; i++) {
      await $.sleeve['setToCommitCrime'](i, 'Homicide');
    }
    return;
  }
  const { factionWorkTypes, crimeStats } = staticData.singularityData;

  // Reserve RAM
  ns.sleeve.getSleeve;
  ns.singularity.getCrimeChance;

  const $getSleeves = (numSleeves: number) =>
    $rip((numSleeves) =>
      Array(numSleeves)
        .fill(0)
        .map(
          (_, num) =>
            ({
              num,
              sleeve: ns.sleeve['getSleeve'](num),
              currentTask: JSON.parse(JSON.stringify(ns.sleeve['getTask'](num))),
            }) as SleeveInfo,
        ),
    )(numSleeves);

  const $doCrimes = async ({ currentTask, num }: SleeveInfo, crime: CrimeType) => {
    if (currentTask?.type !== 'CRIME' || currentTask.crimeType !== crime) {
      await $.sleeve['setToCommitCrime'](num, crime);
    }
  };

  const $gymWorkout = async ({ currentTask, num }: SleeveInfo, stat: GymType) => {
    if (currentTask?.type !== 'CLASS' || currentTask.classType !== stat) {
      await $.sleeve['setToGymWorkout'](num, 'Powerhouse Gym', stat);
    }
  };

  const $study = async ({ currentTask, num }: SleeveInfo, classType: UniversityClassType) => {
    if (currentTask?.type !== 'CLASS' || currentTask.classType !== classType) {
      await $.sleeve['setToUniversityCourse'](num, 'Rothman University', classType);
    }
  };

  const $workForFaction = async (
    { currentTask, num }: SleeveInfo,
    faction: FactionName,
    workType: FactionWorkType,
  ) => {
    if (
      currentTask?.type !== 'FACTION' ||
      currentTask.factionName !== faction ||
      currentTask.factionWorkType !== workType
    ) {
      await $.sleeve['setToFactionWork'](num, faction, workType);
    }
  };

  const $homicide = async (sleeveInfo: SleeveInfo) => {
    const skillToTrain = GYM_STATS.find((skill) => sleeveInfo.sleeve.skills[skill] < 60);
    if (skillToTrain != null) await $gymWorkout(sleeveInfo, ns.enums.GymType[skillToTrain]);
    else await $doCrimes(sleeveInfo, 'Homicide');
  };

  const $sync = async (sleeves: SleeveInfo[]) => {
    const desyncedSleeves = sleeves.filter(({ sleeve }) => sleeve.sync < 100);
    const syncedSleeves = sleeves.filter(({ sleeve }) => sleeve.sync === 100);
    for (const { num } of desyncedSleeves) await $.sleeve['setToSynchronize'](num);
    return syncedSleeves;
  };

  const $recover = async (sleeves: SleeveInfo[]) => {
    const shockedSleeves = sleeves.filter(({ sleeve }) => sleeve.shock > 0);
    const healedSleeves = sleeves.filter(({ sleeve }) => sleeve.shock === 0);
    for (const { num } of shockedSleeves) await $.sleeve['setToShockRecovery'](num);
    return healedSleeves;
  };

  const $train = async (sleeves: SleeveInfo[], stat: GymType) => {
    for (const { num } of sleeves) await $.sleeve['setToGymWorkout'](num, 'Powerhouse Gym', stat);
  };

  const $kill = async (sleeves: SleeveInfo[]) => {
    for (const { num, currentTask } of sleeves) {
      if (currentTask.type !== 'CRIME' || currentTask.crimeType !== 'Homicide') {
        await $.sleeve['setToCommitCrime'](num, 'Homicide');
      }
    }
  };

  const $currentWork = () =>
    $rip(() => {
      const action = ns.singularity['getCurrentWork']();
      if (action == null) return null;
      const { nextCompletion, ...copy } = action;
      return copy;
    })();

  const $playerKarmaRate = async () => {
    const playerAction = await $currentWork();
    if (playerAction?.type !== 'CRIME') return 0;
    const chance = await $.singularity['getCrimeChance'](playerAction.crimeType);
    const stats = crimeStats[playerAction.crimeType];
    return (-chance * stats.karma) / (stats.time / 1000);
  };

  let lastSolve = 0;
  let lastVerdict: Verdict | null = null;
  const $grindKarma = async (sleeves: SleeveInfo[], karma: number) => {
    // Every sleeve is desynced immediately after a node reset, so there is nothing
    // to solve for until $sync has brought at least one up to 100.
    if (sleeves.length === 0) return;
    if (Date.now() - lastSolve < 5000) return;
    lastSolve = Date.now();
    const solveMurder = murderSolver(ns, staticData);
    const startState = { sleeve: sleeves[0].sleeve, numSleeves: sleeves.length, karma, t: 0 };
    lastVerdict = solveMurder(startState, await $playerKarmaRate());
    const { action } = lastVerdict;
    if (action === 'recover') await $recover(sleeves);
    else if (action === 'murder') await $kill(sleeves);
    else await $train(sleeves, action);
  };

  const tc = (str: string) => str[0].toLocaleUpperCase() + str.slice(1);
  const formatTask = (task: SleeveTaskInfo | null) => {
    if (task == null) return 'Idle';
    if (task.type === 'BLADEBURNER') return `${task.actionName}`;
    if (task.type === 'CLASS') {
      if (Object.keys(ns.enums.GymType).includes(task.classType))
        return `Training ${task.classType}`;
      return `Studying ${task.classType}`;
    }
    if (task.type === 'COMPANY') return `Working for ${task.companyName}`;
    if (task.type === 'CRIME') return `${task.crimeType}`;
    if (task.type === 'FACTION') return `${tc(task.factionWorkType)} for ${task.factionName}`;
    if (task.type === 'INFILTRATE') return `Infiltrating`;
    if (task.type === 'RECOVERY') return `Shock Recovery`;
    if (task.type === 'SUPPORT') return 'Support';
    if (task.type === 'SYNCHRO') return 'Synchoronizing';
  };

  type SleeveMode = 'karma' | 'combat' | 'reputation' | 'general';
  const $assignSleeves = async (sleeves: SleeveInfo[]): Promise<SleeveMode | null> => {
    if (sleeves.length === 0) return null;
    const goals = getGoals(ns);
    const isPlayerGrafting = (await $currentWork())?.type === 'GRAFTING';
    const factionRepGoal = goals.prerequisites('FACTION_REP')[0];
    const factionJoinGoal = goals.prerequisites('FACTION_JOIN')[0];
    // TODO: Make sleeves check for Daedalus EITHER branch and pursue shorter one
    const combatGoal = goals.prerequisites('COMBAT_LEVEL').find((goal) => !goal.isDone());
    const karma = ns.heart.break();
    const isGrindingKarma = !ns.gang.inGang() && karma > GANG_KARMA;
    if (isGrindingKarma) {
      await $grindKarma(sleeves, karma);
      return 'karma';
    } else if (combatGoal) {
      for (const sleeveInfo of sleeves) {
        await $gymWorkout(sleeveInfo, ns.enums.GymType[combatGoal.stat]);
      }
      return 'combat';
    } else if (isPlayerGrafting && (factionRepGoal != null || factionJoinGoal != null)) {
      const { faction } = factionRepGoal || factionJoinGoal;
      const [lead, ...helpers] = sleeves;
      const workType = factionWorkTypes[faction][0];
      await $workForFaction(lead, faction, workType);
      if (workType === 'hacking') {
        for (const sleeveInfo of helpers) await $study(sleeveInfo, 'Algorithms');
      } else {
        const playerGymSkills = GYM_STATS.map((name) => ({
          name,
          value: ns.getPlayer().skills[name],
        }));
        const lowestPlayerGymSkill = playerGymSkills.reduce((a, b) => (a.value < b.value ? a : b));
        const stat = ns.enums.GymType[lowestPlayerGymSkill.name];
        for (const sleeveInfo of helpers) await $gymWorkout(sleeveInfo, stat);
      }
      return 'reputation';
    } else {
      for (const sleeveInfo of sleeves) await $homicide(sleeveInfo);
      return 'general';
    }
  };

  ns.disableLog('ALL');
  ns.ui.openTail();
  ns.ui.resizeTail(350, 250);
  ns.ui.moveTail(249, 2);
  while (true) {
    const numSleeves = await $.sleeve['getNumSleeves']();
    const sleeves = await $getSleeves(numSleeves);
    const readySleeves = await $sync(sleeves);
    const mode = await $assignSleeves(readySleeves);
    ns.clearLog();
    const columns = ['#', 'SHOCK', 'TASK'];
    const rows = sleeves.map(({ num, sleeve, currentTask }) => [
      num,
      sleeve.shock ? ns.format.number(sleeve.shock) : 0,
      formatTask(currentTask),
    ]);
    ns.print(table(ns, columns, rows, { colors: true }) + '\n\n');
    if (mode === 'karma' && lastVerdict != null) {
      const { action, timeToGang } = lastVerdict;
      const timeDesc = action === 'murder' ? 'expected' : 'upper bound';
      ns.print(` Gang  ${formatTime(Math.round(timeToGang))} (${timeDesc})` + '\n\n');
    }
    const sleeveCost = await $.sleeve['getSleeveCost']();
    if (sleeveCost < Infinity) {
      ns.print(' Sleeve cost: $' + ns.format.number(sleeveCost) + '\n\n');
    }
    await ns.sleep(50);
  }
}

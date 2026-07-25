import { getStaticData } from '../lib/data-store';
import { getGoals } from '../lib/goals/goals';
import { inPlace, runInPlace } from '../lib/in-place';
import { table } from '../lib/table';

type SleeveTaskInfo = Exclude<SleeveTask, 'nextCompletion'>;
type SleeveInfo = {
  num: number;
  sleeve: SleevePerson;
  currentTask: SleeveTaskInfo;
};

export async function main(ns: NS) {
  const GYM_STATS = Object.keys(ns.enums.GymType) as (keyof GymEnumType)[];
  const { factionWorkTypes } = getStaticData(ns);
  const $ = inPlace(ns, ns.pid);
  const $rip = runInPlace(ns, ns.pid);

  // Reserve RAM
  ns.sleeve.getSleeve;
  ns.sleeve.getTask;

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

  const assignSleeve = async (ns: NS, sleeveInfo: SleeveInfo, tasks: SoloTask[]) => {
    const { sleeve, num } = sleeveInfo;
    if (sleeve.shock > 0) {
      await $.sleeve['setToShockRecovery'](sleeveInfo.num);
    } else if (ns.heart.break() > -54000) {
      const skillToTrain = GYM_STATS.find((skill) => sleeve.skills[skill] < 40);
      if (skillToTrain != null) await $gymWorkout(sleeveInfo, ns.enums.GymType[skillToTrain]);
      else await $doCrimes(sleeveInfo, 'Homicide');
    } else if (sleeveInfo.sleeve.sync < 100) {
      await $.sleeve['setToSynchronize'](num);
    } else {
      if (tasks.length > 0) {
        const doTask = tasks.shift()!;
        await doTask(sleeveInfo);
      } else {
        await $doCrimes(sleeveInfo, 'Homicide');
      }
    }
  };

  type SoloTask = (sleeveInfo: SleeveInfo) => Promise<boolean>;
  const getSoloTasks = (ns: NS): SoloTask[] => {
    const tasks: SoloTask[] = [];
    const isPlayerGrafting = ns.singularity.getCurrentWork()?.type === 'GRAFTING';
    const factionRepGoal = getGoals(ns).prerequisites('FACTION_REP')[0];
    if (isPlayerGrafting && factionRepGoal != null) {
      const { faction } = factionRepGoal;
      const workTypes = factionWorkTypes[faction];
      tasks.push(async (sleeveInfo: SleeveInfo) => {
        const { workType } = workTypes
          .map((workType) => ({
            workType,
            reputation: ns.formulas.work.factionGains(sleeveInfo.sleeve, workType, 0).reputation,
          }))
          .reduce((a, b) => (a.reputation > b.reputation ? a : b));
        return (await $workForFaction(sleeveInfo, faction, workType)) ?? false;
      });
    }
    return tasks;
  };

  ns.disableLog('ALL');
  ns.ui.openTail();
  while (true) {
    ns.clearLog();
    const tasks = getSoloTasks(ns);
    const numSleeves = await $.sleeve['getNumSleeves']();
    const sleeves = await $getSleeves(numSleeves);
    for (const sleeveInfo of sleeves) {
      await assignSleeve(ns, sleeveInfo, tasks);
    }
    const columns = ['#', 'SHOCK', 'TASK'];
    const rows = sleeves.map(({ num, sleeve, currentTask }) => [
      num,
      sleeve.shock ? ns.format.number(sleeve.shock) : 0,
      currentTask.type,
    ]);
    ns.print(table(ns, columns, rows, { colors: true }));
    const sleeveCost = await $.sleeve['getSleeveCost']();
    if (sleeveCost < Infinity) {
      ns.print('\n Sleeve cost: $' + ns.format.number(sleeveCost) + '\n\n');
    }
    await ns.sleep(50);
  }
}

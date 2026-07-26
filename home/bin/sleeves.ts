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

  const assignSleeve = async (ns: NS, sleeveInfo: SleeveInfo) => {
    const { sleeve, num } = sleeveInfo;
    if (sleeve.shock > 0) {
      await $.sleeve['setToShockRecovery'](sleeveInfo.num);
    } else if (ns.heart.break() > -54000) {
      const skillToTrain = GYM_STATS.find((skill) => sleeve.skills[skill] < 60);
      if (skillToTrain != null) await $gymWorkout(sleeveInfo, ns.enums.GymType[skillToTrain]);
      else await $doCrimes(sleeveInfo, 'Homicide');
    } else if (sleeveInfo.sleeve.sync < 100) {
      await $.sleeve['setToSynchronize'](num);
    } else {
      await $doCrimes(sleeveInfo, 'Homicide');
    }
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

  ns.disableLog('ALL');
  ns.ui.openTail();
  ns.ui.resizeTail(350, 200);
  ns.ui.moveTail(240, 2);
  while (true) {
    ns.clearLog();
    const numSleeves = await $.sleeve['getNumSleeves']();
    const sleeves = await $getSleeves(numSleeves);
    const isPlayerGrafting = ns.singularity.getCurrentWork()?.type === 'GRAFTING';
    const factionRepGoal = getGoals(ns).prerequisites('FACTION_REP')[0];
    if (isPlayerGrafting && factionRepGoal != null) {
      const { faction } = factionRepGoal;
      const [lead, ...helpers] = sleeves;
      const workType = factionWorkTypes[faction][0];
      await $workForFaction(lead, faction, workType);
      if (workType === 'hacking') {
        for (const sleeveInfo of helpers) await $study(sleeveInfo, 'Algorithms');
      } else {
        for (const sleeveInfo of helpers) await assignSleeve(ns, sleeveInfo);
      }
    } else {
      for (const sleeveInfo of sleeves) {
        await assignSleeve(ns, sleeveInfo);
      }
    }
    const columns = ['#', 'SHOCK', 'TASK'];
    const rows = sleeves.map(({ num, sleeve, currentTask }) => [
      num,
      sleeve.shock ? ns.format.number(sleeve.shock) : 0,
      formatTask(currentTask),
    ]);
    ns.print(table(ns, columns, rows, { colors: true }) + '\n\n');
    const sleeveCost = await $.sleeve['getSleeveCost']();
    if (sleeveCost < Infinity) {
      ns.print(' Sleeve cost: $' + ns.format.number(sleeveCost) + '\n\n');
    }
    await ns.sleep(50);
  }
}

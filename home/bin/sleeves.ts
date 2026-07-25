import { getGoals } from '../lib/goals/goals';

const assignSleeve = (ns: NS, i: number, tasks: SoloTask[]) => {
  const sleeve = ns.sleeve.getSleeve(i);
  const task = ns.sleeve.getTask(i);
  const train = (stat: 'str' | 'def' | 'dex' | 'agi') => {
    if (task?.type !== 'CLASS' || task.classType !== stat) {
      ns.sleeve.setToGymWorkout(i, 'Powerhouse Gym', stat);
    }
  };
  const doCrimes = (crime: CrimeType) => {
    if (task?.type !== 'CRIME' || task.crimeType !== crime) ns.sleeve.setToCommitCrime(i, crime);
  };
  if (sleeve.shock > 0) {
    ns.sleeve.setToShockRecovery(i);
  } else if (ns.heart.break() > -54000) {
    if (sleeve.skills.strength < 40) train('str');
    else if (sleeve.skills.defense < 40) train('def');
    else if (sleeve.skills.dexterity < 40) train('dex');
    else if (sleeve.skills.agility < 40) train('agi');
    else doCrimes('Homicide');
  } else if (sleeve.sync < 100) {
    ns.sleeve.setToSynchronize(i);
  } else {
    if (tasks.length > 0) {
      const task = tasks.shift()!;
      task(i);
    } else {
      doCrimes('Homicide');
    }
  }
  ns.print(' SLEEVE ' + i + ': ' + JSON.stringify(ns.sleeve.getTask(i)));
  const memCost = ns.sleeve.getMemoryUpgradeCost(i, 1);
  if (memCost < Infinity) ns.print('   mem cost: $' + ns.format.number(memCost));
};

type SoloTask = (i: number) => boolean;
const getSoloTasks = (ns: NS): SoloTask[] => {
  const tasks: SoloTask[] = [];
  const isPlayerGrafting = ns.singularity.getCurrentWork()?.type === 'GRAFTING';
  const factionRepGoal = getGoals(ns).prerequisites('FACTION_REP')[0];
  if (isPlayerGrafting && factionRepGoal != null)
    tasks.push(
      (i: number) => ns.sleeve.setToFactionWork(i, factionRepGoal.faction, 'hacking') ?? false,
    );
  return tasks;
};

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.ui.openTail();
  while (true) {
    ns.clearLog();
    const tasks = getSoloTasks(ns);
    for (let i = 0; i < ns.sleeve.getNumSleeves(); i++) {
      assignSleeve(ns, i, tasks);
    }
    const sleeveCost = ns.sleeve.getSleeveCost();
    if (sleeveCost < Infinity) {
      ns.print('\n Sleeve cost: $' + ns.format.number(sleeveCost) + '\n\n');
    }
    await ns.sleep(50);
  }
}

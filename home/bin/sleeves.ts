import { getGoals } from '../lib/goals/goals';

const assignSleeve = (ns: NS, i: number) => {
  const sleeve = ns.sleeve.getSleeve(i);
  if (sleeve.shock > 0) {
    ns.sleeve.setToShockRecovery(i);
  } else if (ns.heart.break() > -54000) {
    if (sleeve.skills.strength < 40) ns.sleeve.setToGymWorkout(i, 'Powerhouse Gym', 'str');
    else if (sleeve.skills.defense < 40) ns.sleeve.setToGymWorkout(i, 'Powerhouse Gym', 'def');
    else if (sleeve.skills.dexterity < 40) ns.sleeve.setToGymWorkout(i, 'Powerhouse Gym', 'dex');
    else if (sleeve.skills.agility < 40) ns.sleeve.setToGymWorkout(i, 'Powerhouse Gym', 'agi');
    else ns.sleeve.setToCommitCrime(i, 'Homicide');
  } else if (sleeve.sync < 100) {
    ns.sleeve.setToSynchronize(i);
  } else {
    const currentWork = ns.singularity.getCurrentWork();
    const factionRepGoal = getGoals(ns).prerequisites('FACTION_REP')[0];
    if (currentWork?.type === 'GRAFTING' && factionRepGoal) {
      ns.sleeve.setToFactionWork(i, factionRepGoal.faction, 'hacking');
    } else {
      ns.sleeve.setToCommitCrime(i, 'Homicide');
    }
  }
  ns.print('SLEEVE ' + i);
  ns.print('  mem cost: $' + ns.format.number(ns.sleeve.getMemoryUpgradeCost(i, 1)));
};

export async function main(ns: NS) {
  ns.ui.openTail();
  while (true) {
    ns.clearLog();
    for (let i = 0; i < ns.sleeve.getNumSleeves(); i++) {
      assignSleeve(ns, i);
    }
    ns.print('');
    ns.print('Sleeve cost: $' + ns.format.number(ns.sleeve.getSleeveCost()));
    await ns.sleep(50);
  }
}

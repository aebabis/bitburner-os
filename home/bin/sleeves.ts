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
  } else {
    ns.sleeve.setToSynchronize(i);
  }
};

export async function main(ns: NS) {
  while (true) {
    for (let i = 0; i < ns.sleeve.getNumSleeves(); i++) {
      assignSleeve(ns, i);
    }
    await ns.sleep(50);
  }
}

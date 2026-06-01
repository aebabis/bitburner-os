import { shouldWorkHaveFocus } from '../../lib/query-service';
import { putPlayerData } from '../../lib/data-store';

export async function main(ns: NS) {
  const focus = shouldWorkHaveFocus(ns);
  const [stat] = ns.args as (keyof GymEnumType)[];
  if (
    stat !== 'strength' &&
    stat !== 'defense' &&
    stat !== 'dexterity' &&
    stat !== 'agility'
  )
    throw new Error('Illegal stat: ' + stat);
  ns.singularity.gymWorkout('Powerhouse Gym', ns.enums.GymType[stat], focus);
  putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
}

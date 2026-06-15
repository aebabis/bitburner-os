import { putPlayerData } from '../../../lib/data-store';
import { joinSpawnChain } from '../../../lib/service-api';
import { shouldWorkHaveFocus } from '../../../lib/query-service';

const hasStaminaPenalty = (ns: NS) => {
  const [currentStamina, maxStamina] = ns.bladeburner.getStamina();
  return currentStamina * 2 < maxStamina;
};

const trainAgility = (ns: NS) => {
  const focus = shouldWorkHaveFocus(ns);
  if (ns.getPlayer().city !== 'Sector-12') ns.singularity.travelToCity('Sector-12');
  ns.singularity.gymWorkout('Powerhouse Gym', 'agi', focus);
  putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
};

export async function main(ns: NS) {
  const { linkTo } = joinSpawnChain(ns, '/bin/blades/blades.ts');
  if (!hasStaminaPenalty(ns)) {
    await linkTo('/bin/blades/actions/select-mission.ts', 0);
  } else {
    trainAgility(ns);
    await linkTo('/bin/blades/actions/end.ts', 0);
  }
}

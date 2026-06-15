import { shouldWorkHaveFocus } from '../../../lib/query-service';
import { putPlayerData } from '../../../lib/data-store';
import { joinSpawnChain } from '../../../lib/service-api';

const getLowestStat = (ns: NS) => {
  const { skills } = ns.getPlayer();
  const stats = ['strength', 'defense', 'dexterity', 'agility'] as const;
  return stats.reduce((s1, s2) => (skills[s1] < skills[s2] ? s1 : s2));
};

export async function main(ns: NS) {
  const { linkTo } = joinSpawnChain(ns, '/bin/blades/blades.ts');
  const focus = shouldWorkHaveFocus(ns);
  const stat = getLowestStat(ns);
  if (ns.getPlayer().city !== 'Sector-12') ns.singularity.travelToCity('Sector-12');
  ns.singularity.gymWorkout('Powerhouse Gym', ns.enums.GymType[stat], focus);
  putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
  if (ns.bladeburner.inBladeburner()) {
    await linkTo('/bin/blades/actions/end.ts', 0);
  } else {
    await linkTo('/bin/blades/blades.ts', 1000);
  }
}

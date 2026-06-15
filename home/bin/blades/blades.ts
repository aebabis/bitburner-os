import { joinSpawnChain } from '../../lib/service-api';

export async function main(ns: NS) {
  const { linkTo } = joinSpawnChain(ns, '/bin/blades/blades.ts');

  if (!ns.bladeburner.joinBladeburnerDivision()) {
    await linkTo('/bin/blades/actions/gym-workout.ts', 0);
  } else {
    await linkTo('/bin/blades/actions/load-actions.ts', 0);
  }
}

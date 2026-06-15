import { joinSpawnChain } from '../../../lib/service-api';

export async function main(ns: NS) {
  const { linkTo } = joinSpawnChain(ns, '/bin/blades/blades.ts');
  await ns.bladeburner.nextUpdate();
  await linkTo('/bin/blades/load-actions.ts', 0);
}

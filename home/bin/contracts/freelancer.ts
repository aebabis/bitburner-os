import { getSpawnChain } from '../../lib/service-api';

export async function main(ns: NS) {
  const { maxRam } = getSpawnChain(ns);
  ns.ramOverride(maxRam);
  await ns.sleep(1000);
  ns.spawn('/bin/contracts/headhunter.ts', { spawnDelay: 0 });
}

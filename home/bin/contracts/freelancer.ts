import { joinSpawnChain } from '../../lib/service-api';

export async function main(ns: NS) {
  const { linkTo } = joinSpawnChain(ns);
  await linkTo('/bin/contracts/headhunter.ts');
}

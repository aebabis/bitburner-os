import { joinSpawnChain } from '../../lib/spawn-chain';

export async function main(ns: NS) {
  const { linkTo } = joinSpawnChain(ns);
  await linkTo('/bin/contracts/headhunter.ts');
}

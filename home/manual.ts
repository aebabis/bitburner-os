import { liquidate } from './bin/liquidate';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  await liquidate(ns);
}

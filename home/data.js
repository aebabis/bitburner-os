import { getPlayerData, getMoneyData } from './lib/data-store.js';
/** @param {NS} ns */
export async function main(ns) {
  const [type] = ns.args;
  if (type === 'player') {
    ns.tprint(JSON.stringify(getPlayerData(ns), null, 2));
  } else if (type === 'money') {
    ns.tprint(JSON.stringify(getMoneyData(ns), null, 2));
  } else {
    ns.tprint('USAGE: data [player|money]');
  }
}
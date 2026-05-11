import {
  getHostnames,
  getStaticData,
  getGangData,
  getPlayerData,
  getMoneyData,
  getRamData,
  getContractData,
  getGoalsData,
} from './lib/data-store.js';
/** @param {NS} ns */
export async function main(ns) {
  const OPTIONS = {
    hostnames: getHostnames,
    static: getStaticData,
    gang: getGangData,
    player: getPlayerData,
    money: getMoneyData,
    ram: getRamData,
    contracts: getContractData,
    goals: getGoalsData,
  };
  const [type] = ns.args;
  if (typeof type === 'string' && Object.hasOwn(OPTIONS, type)) {
    ns.disableLog('ALL');
    ns.ui.openTail();
    ns.print(JSON.stringify(OPTIONS[type](ns), null, 2));
  } else {
    ns.tprint(`USAGE: data [ ${Object.keys(OPTIONS).sort().join(' | ')} ]`);
  }
}
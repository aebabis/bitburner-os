import {
  getHostnames,
  getStaticData,
  getGangData,
  getPlayerData,
  getMoneyData,
  getRamData,
  getContractData,
} from './lib/data-store.ts';
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
  };
  const usage = () =>
    ns.tprint(`USAGE: data [ ${Object.keys(OPTIONS).sort().join(' | ')} ]`);
  const [input = ''] = ns.args;
  if (typeof input !== 'string') {
    usage();
    return;
  }
  const [type, ...props] = input.split('.');
  if (typeof type === 'string' && Object.hasOwn(OPTIONS, type)) {
    let data = OPTIONS[type](ns);
    while (props.length) {
      data = data[props.shift()];
    }
    ns.disableLog('ALL');
    ns.ui.openTail();
    ns.print(JSON.stringify(data, null, 2));
  } else {
    usage();
  }
}

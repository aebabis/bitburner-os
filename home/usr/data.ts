import { replacer } from '../lib/ports.ts';
import { getHostnames, getStaticData, getPlayerData, getMoneyData } from '../lib/data-store.ts';

export async function main(ns: NS) {
  const OPTIONS = {
    hostnames: getHostnames,
    static: getStaticData,
    player: getPlayerData,
    money: getMoneyData,
  };
  const usage = () => ns.tprint(`USAGE: data [ ${Object.keys(OPTIONS).sort().join(' | ')} ]`);
  const [input = ''] = ns.args;
  if (typeof input !== 'string') {
    usage();
    return;
  }
  const [type, ...props] = input.split('.');
  if (typeof type === 'string' && Object.hasOwn(OPTIONS, type)) {
    let data = OPTIONS[type as keyof typeof OPTIONS](ns);
    while (props.length) {
      data = data[props.shift()! as keyof typeof data];
    }
    ns.disableLog('ALL');
    ns.ui.openTail();
    ns.print(JSON.stringify(data, replacer, 2));
  } else {
    usage();
  }
}

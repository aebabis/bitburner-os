import { nmap } from '/lib/nmap';

/** @param {NS} ns **/
export const stop = async(ns) => {
  ns.tprint('Killing all processes');
  for (const hostname of nmap(ns)) {
    for (const { pid } of ns.ps(hostname))
      ns.closeTail(pid);
    ns.killall(hostname, true);
  }
};

/** @param {NS} ns **/
export async function main(ns) {
  await stop(ns);
}


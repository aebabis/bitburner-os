import { HACK, GROW, WEAKEN, SHARE } from '../etc/filenames';

/** @param {NS} ns **/
export const infect = (ns, /** @type {string[]} */ ...hostnames) => {
  for (const hostname of hostnames)
    ns.scp([HACK, GROW, WEAKEN, SHARE], hostname, 'home');
};

/** @param {NS} ns **/
export const fullInfect = (ns, /** @type {string[]} */ ...hostnames) => {
  const JS = ns.ls('home').filter((f) => f.endsWith('.js'));
  for (const hostname of hostnames) ns.scp(JS, hostname, 'home');
};

/** @param {NS} ns **/
export async function main(ns) {
  return infect(ns, ...ns.args);
}

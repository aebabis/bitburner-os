import { rmi } from '../../lib/rmi';

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  if (!ns.corporation.hasCorporation()) {
    await rmi(ns)('/bin/corporation/create.js', 1, false);
    return;
  }
  await rmi(ns)('/bin/corporation/unlock.js', 1);
  await rmi(ns)('/bin/corporation/industries.js', 1);
}

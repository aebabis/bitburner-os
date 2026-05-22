import { rmi } from '../../lib/rmi';
import { getStaticData } from '../../lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  if (!ns.corporation.hasCorporation()) {
    await rmi(ns)('/bin/corporation/create/corporation.js', 1, false);
    return;
  }

  while (getStaticData(ns).materialData == null)
    await rmi(ns)('/bin/corporation/orders/load-material-data.js');
  while (getStaticData(ns).industryData == null)
    await rmi(ns)('/bin/corporation/orders/load-industry-data.js');

  await rmi(ns)('/bin/corporation/unlock.js');
  await rmi(ns)('/bin/corporation/create/industries.js');
  await rmi(ns)('/bin/corporation/managers/agriculture.js');
}

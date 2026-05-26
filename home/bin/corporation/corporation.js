import { rmi } from '../../lib/rmi';
import { getStaticData, getCorpReports } from '../../lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog('ALL');
  ns.ui.openTail();

  while (!ns.corporation.hasCorporation()) {
    await rmi(ns)('/bin/corporation/create/corporation.js', 1, false);
  }
  
  while (getStaticData(ns).materialData == null)
    await rmi(ns)('/bin/corporation/orders/load-material-data.js');
  while (getStaticData(ns).industryData == null)
    await rmi(ns)('/bin/corporation/orders/load-industry-data.js');

  while (true) {
    const STATES = ['START', 'PURCHASE', 'PRODUCTION', 'EXPORT', 'SALE'];
    const prevState = await ns.corporation.nextUpdate();
    const prevIndex = STATES.indexOf(prevState);
    const currState = STATES.at(prevIndex + 1 - STATES.length);

    if (currState !== 'START') {
      await rmi(ns)('/bin/corporation/unlock.js');
      await rmi(ns)('/bin/corporation/create/industries.js');
      await rmi(ns)('/bin/corporation/create/offices.js');

      await rmi(ns)('/bin/corporation/managers/agriculture.js');
      await rmi(ns)('/bin/corporation/managers/chemicals.js');
      await rmi(ns)('/bin/corporation/managers/tobacco.js');
    }
    const reports = getCorpReports(ns);
    ns.clearLog();
    for (const report of Object.values(reports)) {
      ns.print(report.shift()[0]);
      while (report.length) {
        const row = report.shift();
        ns.print(row.join(' '));
      }
    }
  }
}

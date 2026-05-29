import { rmi } from '../../lib/rmi';
import { getStaticData, getCorpReports } from '../../lib/data-store';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.ui.openTail();
  const { resetInfo } = getStaticData(ns);

  while (!ns.corporation.hasCorporation()) {
    const selfFund = resetInfo.currentNode !== 3;
    await rmi(ns)('/bin/corporation/create/corporation.ts', 1, selfFund);
  }

  while (getStaticData(ns).materialData == null)
    await rmi(ns)('/bin/corporation/orders/load-material-data.ts');
  while (getStaticData(ns).industryData == null)
    await rmi(ns)('/bin/corporation/orders/load-industry-data.ts');

  while (true) {
    const STATES = ['START', 'PURCHASE', 'PRODUCTION', 'EXPORT', 'SALE'];
    const prevState = await ns.corporation.nextUpdate();
    const prevIndex = STATES.indexOf(prevState);
    const currState = STATES.at(prevIndex + 1 - STATES.length);

    if (currState !== 'START') {
      await rmi(ns)('/bin/corporation/unlock.ts');
      await rmi(ns)('/bin/corporation/create/industries.ts');
      await rmi(ns)('/bin/corporation/create/offices.ts');

      await rmi(ns)('/bin/corporation/managers/agriculture.ts');
      await rmi(ns)('/bin/corporation/managers/chemicals.ts');
      await rmi(ns)('/bin/corporation/managers/tobacco.ts');
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

import { getStaticData, getCorpReports } from '../../lib/data-store';
import { inPlace } from '../../lib/in-place';
import {
  $createCorporation,
  $createDivision,
  $getIndustryData,
  $getMaterialData,
  $openOffices,
  $unlock,
} from './corp.rip';
import { DivisionNames } from './constants';
import { $manageAgriculture } from './manage/agriculture';

export async function main(ns: NS) {
  typeof ns.corporation.createCorporation;

  ns.disableLog('ALL');

  const { resetInfo } = getStaticData(ns);

  const $ = inPlace(ns, ns.pid);

  while (!ns.corporation.hasCorporation()) {
    const selfFund = resetInfo.currentNode !== 3;
    while (!(await $createCorporation(ns)(selfFund))) {
      await ns.sleep(1000);
    }
  }
  ns.ui.openTail();

  await $createDivision(ns)('Agriculture');
  const materialData = await $getMaterialData(ns);
  const industryData = await $getIndustryData(ns);

  while (true) {
    const STATES = ['START', 'PURCHASE', 'PRODUCTION', 'EXPORT', 'SALE'];
    const prevState = await ns.corporation.nextUpdate();
    const prevIndex = STATES.indexOf(prevState);
    const currState = STATES.at(prevIndex + 1 - STATES.length);

    if (currState !== 'START') {
      await $unlock(ns);
      await $openOffices(ns);

      const { divisions } = await $.corporation['getCorporation']();
      if (divisions.includes(DivisionNames['Agriculture'])) {
        await $manageAgriculture(ns)(divisions, materialData, industryData);
      }
      if (divisions.includes(DivisionNames['Chemical'])) {
      }
      if (divisions.includes(DivisionNames['Tobacco'])) {
      }
    }
    const reports = getCorpReports(ns);
    ns.clearLog();
    for (const report of Object.values(reports)) {
      ns.print(report.shift()![0]);
      while (report.length) {
        const row = report.shift()!;
        ns.print(row.join(' '));
      }
    }
  }
}

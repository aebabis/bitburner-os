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
import { $manageChemicals } from './manage/chemicals';
import { $manageTobacco } from './manage/tobacco';

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
        await $manageAgriculture(ns, materialData, industryData)(divisions);
      }
      if (divisions.includes(DivisionNames['Chemical'])) {
        await $manageChemicals(ns, materialData, industryData)();
      }
      if (divisions.includes(DivisionNames['Tobacco'])) {
        await $manageTobacco(ns, materialData, industryData)();
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

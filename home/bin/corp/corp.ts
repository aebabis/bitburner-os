import { getStaticData, putMoneyData } from '../../lib/data-store';
import { inPlace } from '../../lib/in-place';
import {
  $createCorporation,
  $createDivision,
  $getIndustryData,
  $getMaterialData,
} from './corp.rip';
import { BOOST_MATERIALS, DivisionNames } from './constants';
import { $manageAgriculture } from './manage/agriculture';
import { $manageChemicals } from './manage/chemicals';
import { $manageTobacco } from './manage/tobacco';
import { table } from '../../lib/table';
import { getTobaccoPlan } from './plans/tobacco-plan';

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
  ns.ui.resizeTail(700, 300);

  await $createDivision(ns)('Agriculture');
  const materialData = await $getMaterialData(ns);
  const industryData = await $getIndustryData(ns);
  const plan = getTobaccoPlan(ns, industryData, materialData);

  while (true) {
    const STATES = ['START', 'PURCHASE', 'PRODUCTION', 'EXPORT', 'SALE'];
    const lastAction = await ns.corporation.nextUpdate();
    const prevIndex = STATES.indexOf(lastAction);
    const nextAction = STATES.at(prevIndex + 1 - STATES.length);

    if (lastAction === 'START') {
      await plan.advance();
    }

    if (nextAction !== 'START') {
      const { divisions } = await $.corporation['getCorporation']();
      if (divisions.includes(DivisionNames['Agriculture'])) {
        await $manageAgriculture(ns, materialData, industryData)(divisions);
      }
      if (divisions.includes(DivisionNames['Chemical'])) {
        await $manageChemicals(ns, materialData, industryData)();
      }
      if (divisions.includes(DivisionNames['Tobacco'])) {
        const reports = await $manageTobacco(ns, materialData, industryData)();
        if (reports) {
          const fmt = new Intl.NumberFormat('en', { notation: 'compact' });
          const f = (n: number) => fmt.format(Math.round(n * 1000) / 1000);
          const cities = Object.values(ns.enums.CityName);
          const columns = ['Material', ...cities];
          const rows = BOOST_MATERIALS.map((material) => [
            material,
            ...cities.map((cityName) => {
              const [have, need] = reports[cityName].boostMaterialProgress[material];
              return `${f(have)}/${f(need)}`;
            }),
          ]);
          ns.print(table(ns, columns, rows, { colors: true }));
        }
      }
      const { dividendEarnings } = await $.corporation['getCorporation']();
      putMoneyData(ns, { dividendEarnings });
    }
    ns.clearLog();
    ns.print(plan.getReport().join('\n'));
  }
}

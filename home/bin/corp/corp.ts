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

  // service precondition for execution is meeting all requirements of corporation.
  // This check can only fail if seed money is spent while service is loading. In this
  // case, we hold the RAM reserve and spin until money is replenished.
  while (!ns.corporation.hasCorporation()) {
    const selfFund = resetInfo.currentNode !== 3;
    while (!(await $createCorporation(ns)(selfFund))) {
      await ns.sleep(1000);
    }
  }
  ns.ui.openTail();
  ns.ui.resizeTail(700, 300);
  ns.ui.moveTail(249, 270);

  await $createDivision(ns)('Agriculture');
  const materialData = await $getMaterialData(ns);
  const industryData = await $getIndustryData(ns);
  const plan = getTobaccoPlan(ns, industryData, materialData);

  const STATES: CorpStateName[] = ['START', 'PURCHASE', 'PRODUCTION', 'EXPORT', 'SALE'];
  let reportTable = '';

  while (true) {
    const lastAction = await ns.corporation.nextUpdate();
    const isNewCycle = lastAction === STATES.at(-1);

    if (isNewCycle) {
      await plan.advance();

      reportTable = '';
      const { divisions, funds, dividendEarnings } = await $.corporation['getCorporation']();
      const maxBoostSpend = 0.01 * funds;
      const divisionBoostBudget = maxBoostSpend / Math.max(1, divisions.length);
      if (divisions.includes(DivisionNames['Agriculture'])) {
        await $manageAgriculture(ns, materialData, industryData)(divisionBoostBudget);
      }
      if (divisions.includes(DivisionNames['Chemical'])) {
        await $manageChemicals(ns, materialData, industryData)(divisionBoostBudget);
      }
      if (divisions.includes(DivisionNames['Tobacco'])) {
        const reports = await $manageTobacco(ns, materialData, industryData)(divisionBoostBudget);
        if (reports) {
          const fmt = new Intl.NumberFormat('en', { notation: 'compact' });
          const f = (n: number) => fmt.format(Math.round(n * 1000) / 1000);
          const cities = Object.values(ns.enums.CityName);
          const columns = ['Material', ...cities];
          const rows = BOOST_MATERIALS.map((material) => [
            material,
            ...cities.map((cityName) => {
              const report = reports[cityName];
              if (report == null) return '-';
              const [have, need] = report.boostMaterialProgress[material] ?? [];
              return `${f(have)}/${f(need)}`;
            }),
          ]);
          reportTable = table(ns, columns, rows, { colors: true });
        }
      }
      putMoneyData(ns, { dividendEarnings });
    }
    ns.clearLog();
    ns.print('\n' + reportTable);
    ns.print(plan.getReport().join('\n'));
  }
}

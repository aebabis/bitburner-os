import { getStaticData } from '../../../lib/data-store';
import { BOOST_MATERIALS, DivisionNames } from '../constants';
import { getBoostTargets } from '../boost-solver';
import { getActions } from '../orders/actions';
import { startReport } from './report';

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");


  const INDUSTRY = 'Tobacco';
  const { materialData, industryData } = getStaticData(ns);

  const divisionName = DivisionNames[INDUSTRY];
  const report = startReport(ns, divisionName);
  const division = ns.corporation.getDivision(divisionName);
  const { requiredMaterials } = industryData[INDUSTRY];

  /** @type {CorpMaterialName[]} */
  const materialNames = Object.keys(requiredMaterials);

  for (const cityName of division.cities) {
    report.add([' ' + cityName]);
    const { buy, sell } = getActions(ns, divisionName, cityName);

    if (!ns.corporation.hasWarehouse(divisionName, cityName)) {
      continue;
    }

    const format = (/** @type number */ num) => ns.format.number(num, 1);

    const warehouse = ns.corporation.getWarehouse(divisionName, cityName);
    const product = ns.corporation.getProduct(divisionName, cityName, "R'");
    const outputVolume = product.productionAmount * product.size;
    report.add(['  Output Volume:', ''+format(product.productionAmount)]);

    const BUFFER = warehouse.size * .1;
    const TARGET_INPUT_VOLUME = 10;
    const MAX_INPUT_VOLUME = TARGET_INPUT_VOLUME + 10;
    const BOOST_VOLUME = warehouse.size - BUFFER - MAX_INPUT_VOLUME - outputVolume;

    const BATCH_INPUT_VOLUME = materialNames.map((material) => (
      requiredMaterials[material] * materialData[material].size
    )).reduce((a, b) => a + b, 0);
    const BATCH_INPUT_MAX = MAX_INPUT_VOLUME / BATCH_INPUT_VOLUME;

    for (const material of materialNames) {
      const coefficient = requiredMaterials[material];
      const { stored } = ns.corporation.getMaterial(divisionName, cityName, material);
      const surplus = stored - coefficient * BATCH_INPUT_MAX;

      if (surplus > 0)
        await sell(material, surplus / 100, 'MP/2');
      else
        await buy(material, 0);
      report.add(['  '+material+':', format(stored) + '/' + format(product.productionAmount)]);
    }

    const boostTargets = getBoostTargets(ns, INDUSTRY, BOOST_VOLUME);
    for (const material of BOOST_MATERIALS) {
      const { stored } = ns.corporation.getMaterial(divisionName, cityName, material);
      const targetAmount = boostTargets[material];
      if (stored < targetAmount)
        await buy(material, 1);
      else if (stored - targetAmount > 10)
        await sell(material, 1, 'MP');
      else
        await buy(material, 0);
      report.add(['  '+material+':', format(stored) + '/' + format(targetAmount)]);
    }
  }
  report.send();
}

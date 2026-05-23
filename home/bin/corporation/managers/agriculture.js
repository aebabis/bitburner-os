import { rmi } from '../../../lib/rmi';
import { getStaticData } from '../../../lib/data-store';
import { BOOST_MATERIALS, DivisionNames } from '../constants';
import { getBoostTargets } from '../boost-solver';

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  
  const { materialData, industryData } = getStaticData(ns);

  const divisionName = DivisionNames['Agriculture'];
  const division = ns.corporation.getDivision(divisionName);
  const { requiredMaterials } = industryData['Agriculture'];

  /** @type {CorpMaterialName[]} */
  const materialNames = Object.keys(requiredMaterials);

  for (const city of division.cities) {
    /** @param {CorpMaterialName} material @param {number} amount */
    const buy = async (material, amount) => {
      await rmi(ns)('/bin/corporation/orders/buy-material.js', 1, divisionName, city, material, amount);
      await rmi(ns)('/bin/corporation/orders/sell-material.js', 1, divisionName, city, material, 0, 'MP*100');
    };
    /** @param {CorpMaterialName} material @param {number} amount @param {string} price */
    const sell = async (material, amount, price) => {
      await rmi(ns)('/bin/corporation/orders/buy-material.js', 1, divisionName, city, material, 0);
      await rmi(ns)('/bin/corporation/orders/sell-material.js', 1, divisionName, city, material, amount, price);
    };

    if (!ns.corporation.hasWarehouse(divisionName, city)) {
      continue;
    }
    const warehouse = ns.corporation.getWarehouse(divisionName, city);

    const BUFFER = warehouse.size * .1;
    const TARGET_VOLUME = warehouse.size * .1;
    const MAX_VOLUME = warehouse.size * .2;
    const BOOST_VOLUME = warehouse.size - (BUFFER + TARGET_VOLUME + MAX_VOLUME);

    const BATCH_INPUT_VOLUME = materialNames.map((material) => (
      requiredMaterials[material] * materialData[material].size
    )).reduce((a, b) => a + b, 0);
    const BATCH_INPUT_TSL = TARGET_VOLUME / BATCH_INPUT_VOLUME;
    const BATCH_INPUT_MAX = MAX_VOLUME / BATCH_INPUT_VOLUME;

    const productionRate = ns.corporation.getMaterial(divisionName, city, 'Food').productionAmount;

    for (const material of materialNames) {
      const coefficient = requiredMaterials[material];

      const tsl = coefficient * BATCH_INPUT_TSL;
      const demand = coefficient * Math.min(BATCH_INPUT_MAX, productionRate);

      const { stored } = ns.corporation.getMaterial(divisionName, city, material);
      const needed = demand + tsl - stored;
      const surplus = stored - BATCH_INPUT_MAX;

      if (needed > 0)
        await buy(material, needed);
      else if (surplus > 0)
        await sell(material, surplus / 100, 'MP/2');
      else
        await buy(material, 0);
    }

    const boostTargets = getBoostTargets(ns, 'Agriculture', BOOST_VOLUME);
    for (const material of BOOST_MATERIALS) {
      const { stored } = ns.corporation.getMaterial(divisionName, city, material);
      const targetAmount = boostTargets[material];
      if (stored < targetAmount)
        await buy(material, 1);
      else if (stored - targetAmount > 10)
        await sell(material, 1, 'MP');
      else
        await buy(material, 0);
    }
  }
}

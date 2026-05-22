import { rmi } from '../../../lib/rmi';
import { getStaticData } from '../../../lib/data-store';
import { DivisionNames } from '../constants';

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

    const warehouse = ns.corporation.getWarehouse(divisionName, city);

    const TARGET_VOLUME = warehouse.size * .1;
    const MAX_VOLUME = warehouse.size * .9;
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
      const surplus = BATCH_INPUT_MAX - stored;

      if (needed > 0)
        await buy(material, needed);
      else if (surplus > 0)
        await sell(material, 1, 'MP/2');
      else
        await buy(material, 0);
    }
  }
}

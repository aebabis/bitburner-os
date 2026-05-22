import { rmi } from '../../lib/rmi';
import { getStaticData } from '../../lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  const { materialData, industryData } = getStaticData(ns);

  for (const divisionName of ns.corporation.getCorporation().divisions) {
    const division = ns.corporation.getDivision(divisionName);
    if (!division) {
      continue;
    }
    const { requiredMaterials } = industryData[division.industry];
    /** @type {CorpMaterialName[]} */
    const materialNames = Object.keys(requiredMaterials);

    for (const city of division.cities) {
      /** @param {CorpMaterialName} material @param {number} amount */
      const buy = async (material, amount) => {
        await rmi(ns)('/bin/corporation/orders/buy-material.js', 1, division.name, city, material, amount);
        await rmi(ns)('/bin/corporation/orders/sell-material.js', 1, division.name, city, material, 0, 'MP*100');
      };
      /** @param {CorpMaterialName} material @param {number} amount @param {string} price */
      const sell = async (material, amount, price) => {
        await rmi(ns)('/bin/corporation/orders/buy-material.js', 1, division.name, city, material, 0);
        await rmi(ns)('/bin/corporation/orders/sell-material.js', 1, division.name, city, material, amount, price);
      };

      const warehouse = ns.corporation.getWarehouse(division.name, city);
      const targetTotalVolume = warehouse.size / 2;
      const ratioTotal = Object.values(requiredMaterials).reduce((a,b) => a+b, 0);
      for (const material of materialNames) {
        const coefficient = requiredMaterials[material];
        const targetVolume = Math.floor(targetTotalVolume * coefficient / ratioTotal);
        const targetAmount = targetVolume / materialData[material].size;
        const { stored } = ns.corporation.getMaterial(division.name, city, material);
        const needed = targetAmount - stored;
        const surplus = stored - targetAmount * 1.1;
        if (needed > 0)
          await buy(material, needed * (warehouse.size - warehouse.sizeUsed) / warehouse.size);
        else if (surplus > 0)
          await sell(material, 1, 'MP/2');
        else
          await buy(material, 0);
      }
    }
  }
}

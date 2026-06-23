import { DivisionNames } from '../constants';
import {
  $buyBoostMaterials,
  $buyProductionMaterials,
  $getDivision,
  $getOutputVolume,
  $getWarehouse,
  $handleMorale,
  $sell,
  $transfer,
} from '../corp.rip';

export const $manageAgriculture =
  (
    ns: NS,
    materialData: Record<CorpMaterialName, CorpMaterialConstantData>,
    industryData: Record<CorpIndustryName, CorpIndustryData>,
  ) =>
  async (divisions: string[]) => {
    const INDUSTRY = 'Agriculture';

    const divisionName = DivisionNames[INDUSTRY];
    const { requiredMaterials } = industryData[INDUSTRY];
    const division = await $getDivision(ns)(divisionName);

    if (division == null) return;

    for (const cityName of division.cities) {
      await $handleMorale(ns)(divisionName, cityName);
      const warehouse = await $getWarehouse(ns)(divisionName, cityName);
      if (!warehouse) {
        continue;
      }

      const outputVolume = await $getOutputVolume(
        ns,
        materialData,
        industryData,
      )(INDUSTRY, cityName);
      await $buyProductionMaterials(ns, materialData)(
        INDUSTRY,
        cityName,
        requiredMaterials,
        'Food',
      );
      await $buyBoostMaterials(ns, materialData, industryData)(
        INDUSTRY,
        cityName,
        warehouse.size,
        outputVolume,
      );

      await $sell(ns)(divisionName, cityName, 'Food', 'MAX', 'MP');

      const tobacco = DivisionNames['Tobacco'];
      const chemical = DivisionNames['Chemical'];
      const hasTobacco = divisions.includes(tobacco);
      const hasChem = divisions.includes(chemical);
      const PLANT_TSL = Math.floor(10 / materialData['Plants'].size);
      if (hasTobacco) {
        await $transfer(ns)(
          divisionName,
          cityName,
          tobacco,
          cityName,
          'Plants',
          `(-IPROD-IINV+${PLANT_TSL})/10`,
        );
      }
      if (hasChem) {
        await $transfer(ns)(
          divisionName,
          cityName,
          chemical,
          cityName,
          'Plants',
          `(-IPROD-IINV+${PLANT_TSL})/10`,
        );
      }
      await $sell(ns)(divisionName, cityName, 'Plants', 'MAX', 'MP');
    }
  };

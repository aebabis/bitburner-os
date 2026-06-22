import { DivisionNames } from '../constants';
import {
  $buyBoostMaterials,
  $buyProductionMaterials,
  $getDivision,
  $getOutputVolume,
  $getWarehouse,
  $sell,
  $transfer,
} from '../corp.rip';

export const $manageAgriculture =
  (ns: NS) =>
  async (
    divisions: string[],
    materialData: Record<CorpMaterialName, CorpMaterialConstantData>,
    industryData: Record<CorpIndustryName, CorpIndustryData>,
  ) => {
    const INDUSTRY = 'Agriculture';

    const divisionName = DivisionNames[INDUSTRY];
    const { requiredMaterials } = industryData[INDUSTRY];
    const division = await $getDivision(ns)(divisionName);

    if (division == null) return;

    for (const city of division.cities) {
      const warehouse = await $getWarehouse(ns)(divisionName, city);
      if (!warehouse) {
        continue;
      }

      const outputVolume = await $getOutputVolume(ns, materialData, industryData)(INDUSTRY, city);
      await $buyProductionMaterials(ns, materialData)(INDUSTRY, city, requiredMaterials, 'Food');
      await $buyBoostMaterials(ns, materialData, industryData)(
        INDUSTRY,
        city,
        warehouse.size,
        outputVolume,
      );

      await $sell(ns)(divisionName, city, 'Food', 'MAX', 'MP');

      const tobacco = DivisionNames['Tobacco'];
      const chemical = DivisionNames['Chemical'];
      const hasTobacco = divisions.includes(tobacco);
      const hasChem = divisions.includes(chemical);
      const PLANT_TSL = Math.floor(10 / materialData['Plants'].size);
      if (hasTobacco) {
        await $transfer(ns)(
          divisionName,
          city,
          tobacco,
          city,
          'Plants',
          `(-IPROD-IINV+${PLANT_TSL})/10`,
        );
      }
      if (hasChem) {
        await $transfer(ns)(
          divisionName,
          city,
          chemical,
          city,
          'Plants',
          `(-IPROD-IINV+${PLANT_TSL})/10`,
        );
      }
      if (!hasTobacco && !hasChem) await $sell(ns)(divisionName, city, 'Plants', 'MAX', 'MP');
      else await $sell(ns)(divisionName, city, 'Plants', 0, '100*MP');
    }
  };

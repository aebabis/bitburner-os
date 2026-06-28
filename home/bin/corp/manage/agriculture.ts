import { DivisionNames } from '../constants';
import {
  $buyBoostMaterials,
  $getDivision,
  $getOutputVolume,
  $getWarehouse,
  $handleMorale,
  $sell,
} from '../corp.rip';

export const $manageAgriculture =
  (
    ns: NS,
    materialData: Record<CorpMaterialName, CorpMaterialConstantData>,
    industryData: Record<CorpIndustryName, CorpIndustryData>,
  ) =>
  async () => {
    const INDUSTRY = 'Agriculture';

    const divisionName = DivisionNames[INDUSTRY];
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
      await $buyBoostMaterials(ns, materialData, industryData)(
        INDUSTRY,
        cityName,
        warehouse.size,
        outputVolume,
      );
      await $sell(ns)(divisionName, cityName, 'Food', 'MAX', 'MP');
      await $sell(ns)(divisionName, cityName, 'Plants', 'MAX', 'MP');
    }
  };

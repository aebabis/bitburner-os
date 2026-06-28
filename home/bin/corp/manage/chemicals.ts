import { DivisionNames } from '../constants';
import {
  $buyBoostMaterials,
  $buyProductionMaterials,
  $getDivision,
  $getOutputVolume,
  $getWarehouse,
  $handleMorale,
  $sell,
} from '../corp.rip';

export const $manageChemicals =
  (
    ns: NS,
    materialData: Record<CorpMaterialName, CorpMaterialConstantData>,
    industryData: Record<CorpIndustryName, CorpIndustryData>,
  ) =>
  async () => {
    const INDUSTRY = 'Chemical';

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
        'Chemicals',
      );
      await $buyBoostMaterials(ns, materialData, industryData)(
        INDUSTRY,
        cityName,
        warehouse.size,
        outputVolume,
      );
      await $sell(ns)(divisionName, cityName, 'Chemicals', 'MAX', 'MP');
    }
  };

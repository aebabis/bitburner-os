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

export const $manageMaterialIndustry =
  (
    ns: NS,
    materialData: Record<CorpMaterialName, CorpMaterialConstantData>,
    industryData: Record<CorpIndustryName, CorpIndustryData>,
  ) =>
  async (industry: CorpIndustryName, boostBudget: number) => {
    const divisionName = DivisionNames[industry];
    const { requiredMaterials, producedMaterials } = industryData[industry];
    const division = await $getDivision(ns)(divisionName);

    if (division == null) return;

    let budget = boostBudget;
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
      )(industry, cityName);
      for (const material of Object.keys(requiredMaterials)) {
        await $buyProductionMaterials(ns, materialData)(
          industry,
          cityName,
          requiredMaterials,
          material as CorpMaterialName,
        );
      }
      const { spent } = await $buyBoostMaterials(ns, materialData, industryData)(
        industry,
        cityName,
        warehouse,
        outputVolume,
        budget,
      );
      budget -= spent;
      for (const material of producedMaterials || []) {
        await $sell(ns)(divisionName, cityName, material as CorpMaterialName, 'MAX', 'MP');
      }
    }
  };

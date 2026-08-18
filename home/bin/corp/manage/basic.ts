import { DivisionNames } from '../constants';
import {
  $research,
  $buyBoostMaterials,
  $buyProductionMaterials,
  $getDivision,
  $getOutputVolume,
  $getWarehouse,
  $handleMorale,
  $sell,
} from '../corp.rip';

const DEFAULT_RESEARCH_SEQUENCE: CorpResearchName[] = [
  'Hi-Tech R&D Laboratory',
  'Overclock',
  'Sti.mu',
  'Drones',
  'Drones - Assembly',
  'Drones - Transport',
  'Self-Correcting Assemblers',
  'Automatic Drug Administration',
  'Go-Juice',
  'CPH4 Injections',
  'AutoBrew',
  'AutoPartyManager',
];

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

    await $research(ns)(division, DEFAULT_RESEARCH_SEQUENCE);

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

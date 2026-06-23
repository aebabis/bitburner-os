import { inPlace } from '../../../lib/in-place';
import { DivisionNames } from '../constants';
import {
  $buyBoostMaterials,
  $buyProductionMaterials,
  $getDivision,
  $getWarehouse,
  $handleMorale,
} from '../corp.rip';

export const $manageTobacco =
  (
    ns: NS,
    materialData: Record<CorpMaterialName, CorpMaterialConstantData>,
    industryData: Record<CorpIndustryName, CorpIndustryData>,
  ) =>
  async () => {
    const INDUSTRY = 'Tobacco';

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

      const product = await inPlace(ns, ns.pid).corporation['getProduct'](
        divisionName,
        cityName,
        "R'",
      );
      const outputVolume = product.productionAmount * product.size;

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
    }
  };

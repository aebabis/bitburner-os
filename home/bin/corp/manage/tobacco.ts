import { inPlace } from '../../../lib/in-place';
import { DivisionNames } from '../constants';
import {
  $buyBoostMaterials,
  $buyProductionMaterials,
  $getDivision,
  $getWarehouse,
  $handleMorale,
  $manageProducts,
} from '../corp.rip';

const HQ = 'Sector-12';
const BRAND_1 = "R'";
const BRAND_2 = 'R"';

export const $manageTobacco =
  (
    ns: NS,
    materialData: Record<CorpMaterialName, CorpMaterialConstantData>,
    industryData: Record<CorpIndustryName, CorpIndustryData>,
  ) =>
  async () => {
    const $ = inPlace(ns, ns.pid);
    const INDUSTRY = 'Tobacco';

    const divisionName = DivisionNames[INDUSTRY];
    const { requiredMaterials } = industryData[INDUSTRY];
    const division = await $getDivision(ns)(divisionName);

    if (division == null) return;

    const currentProduct = await $manageProducts(ns)(
      divisionName,
      HQ,
      division.products,
      BRAND_1,
      BRAND_2,
    );

    if (currentProduct == null) return;

    for (const cityName of division.cities) {
      await $handleMorale(ns)(divisionName, cityName);
      const warehouse = await $getWarehouse(ns)(divisionName, cityName);
      if (!warehouse) {
        continue;
      }

      const productStats = await $.corporation['getProduct'](
        divisionName,
        cityName,
        currentProduct.name,
      );
      const outputVolume = productStats.productionAmount * productStats.size;

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
      await $.corporation['sellProduct'](
        divisionName,
        cityName,
        currentProduct.name,
        'MAX',
        'MP',
        false,
      );
    }
  };

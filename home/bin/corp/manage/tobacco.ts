import { inPlace } from '../../../lib/in-place';
import { DivisionNames } from '../constants';
import {
  $buyBoostMaterials,
  $getDivision,
  $getWarehouse,
  $handleMorale,
  $manageProducts,
  BoostMaterialProgress,
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
  async (boostBudget: number) => {
    const $ = inPlace(ns, ns.pid);
    const INDUSTRY = 'Tobacco';

    const divisionName = DivisionNames[INDUSTRY];
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

    let hasTA2 = await $.corporation['hasResearched'](divisionName, 'Market-TA.II');
    if (!hasTA2) {
      const hasTA1 = await $.corporation['hasResearched'](divisionName, 'Market-TA.I');
      const ta1Cost = hasTA1
        ? 0
        : await $.corporation['getResearchCost'](divisionName, 'Market-TA.I');
      const ta2Cost = await $.corporation['getResearchCost'](divisionName, 'Market-TA.II');
      if (division.researchPoints >= ta1Cost + ta2Cost + 10000) {
        if (!hasTA1) {
          await $.corporation['research'](divisionName, 'Market-TA.I');
        }
        await $.corporation['research'](divisionName, 'Market-TA.II');
        hasTA2 = true;
      }
    }

    const report = {} as Record<CityName, { boostMaterialProgress: BoostMaterialProgress }>;
    let budget = boostBudget;
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

      const { progress: boostMaterialProgress, spent } = await $buyBoostMaterials(
        ns,
        materialData,
        industryData,
      )(INDUSTRY, cityName, warehouse, outputVolume, budget);
      budget -= spent;
      await $.corporation['sellProduct'](
        divisionName,
        cityName,
        currentProduct.name,
        'MAX',
        'MP',
        false,
      );
      if (hasTA2) {
        await $.corporation['setProductMarketTA2'](divisionName, currentProduct.name, true);
      }
      report[cityName] = { boostMaterialProgress };
    }
    return report;
  };

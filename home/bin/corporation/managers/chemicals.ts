import { getStaticData } from '../../../lib/data-store';
import { BOOST_MATERIALS, DivisionNames } from '../constants';
import { getBoostTargets } from '../boost-solver';
import { getActions } from '../orders/actions';
import { getDivision } from './get-division';

export async function main(ns: NS) {
  ns.disableLog('ALL');

  const INDUSTRY = 'Chemical';
  const { materialData, industryData } = getStaticData(ns);

  const divisionName = DivisionNames[INDUSTRY];
  if (materialData == null || industryData == null)
    throw new Error('Static data not properly initialized');
  const { requiredMaterials } = industryData[INDUSTRY];
  const division = getDivision(ns, divisionName);

  if (division == null) return;

  const materialNames = Object.keys(requiredMaterials) as CorpMaterialName[];

  for (const city of division.cities) {
    const { buy, sell } = getActions(ns, divisionName, city);

    if (!ns.corporation.hasWarehouse(divisionName, city)) {
      continue;
    }
    const warehouse = ns.corporation.getWarehouse(divisionName, city);

    const chemRate = ns.corporation.getMaterial(
      divisionName,
      city,
      'Chemicals',
    ).productionAmount;
    const outputVolume = chemRate * materialData['Chemicals'].size;

    const BUFFER = warehouse.size * 0.1;
    const TARGET_INPUT_VOLUME = 10;
    const MAX_INPUT_VOLUME = TARGET_INPUT_VOLUME + 10;
    const BOOST_VOLUME =
      warehouse.size - BUFFER - MAX_INPUT_VOLUME - outputVolume;

    const BATCH_INPUT_VOLUME = materialNames
      .map(
        (material) =>
          requiredMaterials[material]! * materialData[material].size,
      )
      .reduce((a, b) => a + b, 0);
    const BATCH_INPUT_TSL = TARGET_INPUT_VOLUME / BATCH_INPUT_VOLUME;
    const BATCH_INPUT_MAX = MAX_INPUT_VOLUME / BATCH_INPUT_VOLUME;

    const productionRate = ns.corporation.getMaterial(
      divisionName,
      city,
      'Food',
    ).productionAmount;

    for (const material of materialNames) {
      const coefficient = requiredMaterials[material]!;

      const tsl = coefficient * BATCH_INPUT_TSL;
      const demand = coefficient * Math.min(BATCH_INPUT_MAX, productionRate);

      const { stored } = ns.corporation.getMaterial(
        divisionName,
        city,
        material,
      );
      const needed = demand + tsl - stored;
      const surplus = stored - coefficient * BATCH_INPUT_MAX;

      if (needed > 0) await buy(material, needed);
      else if (surplus > 0) await sell(material, surplus / 100, 'MP/2');
      else await buy(material, 0);
    }

    const boostTargets = getBoostTargets(ns, INDUSTRY, BOOST_VOLUME);
    for (const material of BOOST_MATERIALS) {
      const { stored } = ns.corporation.getMaterial(
        divisionName,
        city,
        material,
      );
      const targetAmount = boostTargets[material];
      if (stored < targetAmount) await buy(material, 1);
      else if (stored - targetAmount > 10) await sell(material, 1, 'MP');
      else await buy(material, 0);
    }
  }
}

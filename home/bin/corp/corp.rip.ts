import { inPlace, runInPlace } from '../../lib/in-place';
import { getBoostTargets } from './boost-solver';
import { BOOST_MATERIALS, CORP_NAME, DivisionName, DivisionNames } from './constants';

export const $createCorporation = (ns: NS) => async (selfFund: boolean) =>
  runInPlace(
    ns,
    ns.pid,
  )((corpName: string, selfFund: boolean) => {
    return (
      ns.corporation.hasCorporation() ||
      (ns.corporation.canCreateCorporation(selfFund) &&
        ns.corporation['createCorporation'](corpName, selfFund))
    );
  })(CORP_NAME, selfFund);

export const $getMaterialData = (ns: NS) =>
  runInPlace(
    ns,
    ns.pid,
  )(() => {
    const { materialNames } = ns.corporation.getConstants();
    return Object.fromEntries(
      materialNames.map((material) => [material, ns.corporation['getMaterialData'](material)]),
    ) as Record<CorpMaterialName, CorpMaterialConstantData>;
  })();

export const $getIndustryData = (ns: NS) =>
  runInPlace(
    ns,
    ns.pid,
  )(() => {
    const { industryNames } = ns.corporation.getConstants();
    return Object.fromEntries(
      industryNames.map((industry) => [industry, ns.corporation['getIndustryData'](industry)]),
    ) as Record<CorpIndustryName, CorpIndustryData>;
  })();

export const $unlock = async (ns: NS) => {
  const $ = inPlace(ns, ns.pid);
  const hasSmartSupply = await $.corporation['hasUnlock']('Smart Supply');
  if (!hasSmartSupply) {
    const smartSupplyCost = await $.corporation['getUnlockCost']('Smart Supply');
    const { funds } = await $.corporation['getCorporation']();
    if (smartSupplyCost <= funds) {
      await $.corporation['purchaseUnlock']('Smart Supply');
    }
  }
};

export const $createDivision = (ns: NS) => async (industry: CorpIndustryName) => {
  const divisionName = DivisionNames[industry];
  const $ = inPlace(ns, ns.pid);
  const { divisions } = await $.corporation['getCorporation']();
  if (!divisions.includes(divisionName)) {
    await $.corporation['expandIndustry'](industry, divisionName);
  }
};

export const $openOffices = async (ns: NS) => {
  const { officeInitialCost, warehouseInitialCost } = ns.corporation.getConstants();

  const RESERVE_FUNDS = 20e9;
  const SETUP_COST = officeInitialCost + warehouseInitialCost;

  const $ = inPlace(ns, ns.pid);
  let { divisions, funds } = await $.corporation['getCorporation']();

  for (const divisionName of divisions) {
    const division = await $.corporation['getDivision'](divisionName);
    for (const city of Object.values(ns.enums.CityName)) {
      if (!division.cities.includes(city)) {
        if (funds - SETUP_COST > RESERVE_FUNDS) {
          await $.corporation['expandCity'](divisionName, city);
          await $.corporation['purchaseWarehouse'](divisionName, city);
          funds -= SETUP_COST;
        }
      }
    }
  }
};

export const $handleMorale = (ns: NS) => async (divisionName: DivisionName, cityName: CityName) => {
  const $ = inPlace(ns, ns.pid);
  const office = await $.corporation['getOffice'](divisionName, cityName);
  if (office.avgEnergy < 98) {
    await $.corporation['buyTea'](divisionName, cityName);
  }
  if (office.avgMorale < 95) {
    const personCost = 500000;
    const result = await $.corporation['throwParty'](divisionName, cityName, personCost);
    if (result) {
      const cost = ns.format.number(office.numEmployees * personCost);
      ns.print(`Party for ${divisionName} in ${cityName}: ${result} for $${cost}`);
    }
  }
};

export const $getDivision = (ns: NS) => async (divisionName: DivisionName) => {
  try {
    return await inPlace(ns, ns.pid).corporation['getDivision'](divisionName);
  } catch (error) {
    return null;
  }
};

export const $getWarehouse = (ns: NS) => async (divisionName: DivisionName, cityName: CityName) => {
  try {
    return await inPlace(ns, ns.pid).corporation['getWarehouse'](divisionName, cityName);
  } catch (error) {
    return null;
  }
};

const $buy =
  (ns: NS) =>
  async (divisionName: string, cityName: CityName, material: CorpMaterialName, amount: number) => {
    const $ = inPlace(ns, ns.pid);
    await $.corporation['buyMaterial'](divisionName, cityName, material, amount);
    await $.corporation['sellMaterial'](divisionName, cityName, material, '0', 'MP*100');
  };

export const $sell =
  (ns: NS) =>
  async (
    divisionName: string,
    cityName: CityName,
    material: CorpMaterialName,
    amount: string | number,
    price: string,
  ) => {
    const $ = inPlace(ns, ns.pid);
    await $.corporation['buyMaterial'](divisionName, cityName, material, 0);
    await $.corporation['sellMaterial'](divisionName, cityName, material, amount.toString(), price);
  };

export const $transfer =
  (ns: NS) =>
  async (
    sourceDivision: string,
    sourceCity: CityName,
    targetDivision: string,
    targetCity: CityName,
    material: CorpMaterialName,
    amount: number | string,
  ) => {
    const $ = inPlace(ns, ns.pid);
    await $.corporation['cancelExportMaterial'](
      sourceDivision,
      sourceCity,
      targetDivision,
      targetCity,
      material,
    );
    await $.corporation['exportMaterial'](
      sourceDivision,
      sourceCity,
      targetDivision,
      targetCity,
      material,
      amount,
    );
  };

export const $getOutputVolume =
  (
    ns: NS,
    materialData: Record<CorpMaterialName, CorpMaterialConstantData>,
    industryData: Record<CorpIndustryName, CorpIndustryData>,
  ) =>
  async (industry: CorpIndustryName, cityName: CityName) => {
    const divisionName = DivisionNames[industry];
    const $ = inPlace(ns, ns.pid);
    let outputVolume = 0;
    const { producedMaterials = [] } = industryData[industry];
    for (const materialName of producedMaterials) {
      const { productionAmount } = await $.corporation['getMaterial'](
        divisionName,
        cityName,
        materialName,
      );
      outputVolume += productionAmount * materialData[materialName].size;
    }
    return outputVolume;
  };

// TODO: Have separate function that allocates space for
// materials, products, and boost materials and which
// considers whether inputs or outputs take up more space.

const TARGET_INPUT_VOLUME = 10;
const MAX_INPUT_VOLUME = TARGET_INPUT_VOLUME + 10;

export const $buyProductionMaterials =
  (ns: NS, materialData: Record<CorpMaterialName, CorpMaterialConstantData>) =>
  async (
    industry: CorpIndustryName,
    cityName: CityName,
    requiredMaterials: Partial<Record<CorpMaterialName, number>>,
    primaryOutput: CorpMaterialName,
  ) => {
    const materialNames = Object.keys(requiredMaterials) as CorpMaterialName[];
    const BATCH_INPUT_VOLUME = materialNames
      .map((material) => requiredMaterials[material]! * materialData[material].size)
      .reduce((a, b) => a + b, 0);
    const BATCH_INPUT_TSL = TARGET_INPUT_VOLUME / BATCH_INPUT_VOLUME;
    const BATCH_INPUT_MAX = MAX_INPUT_VOLUME / BATCH_INPUT_VOLUME;
    const $ = inPlace(ns, ns.pid);
    const divisionName = DivisionNames[industry];
    const { productionAmount } = await $.corporation['getMaterial'](
      divisionName,
      cityName,
      primaryOutput,
    );
    for (const material of materialNames) {
      const coefficient = requiredMaterials[material]!;

      const tsl = coefficient * BATCH_INPUT_TSL;
      const demand = coefficient * Math.min(BATCH_INPUT_MAX, productionAmount);

      const { stored } = await $.corporation['getMaterial'](divisionName, cityName, material);
      const needed = demand + tsl - stored;
      const surplus = stored - coefficient * BATCH_INPUT_MAX;

      if (needed > 0) await $buy(ns)(divisionName, cityName, material, needed);
      else if (surplus > 0)
        await $sell(ns)(divisionName, cityName, material, surplus / 100, 'MP/2');
      else await $buy(ns)(divisionName, cityName, material, 0);
    }
  };

export const $buyBoostMaterials =
  (
    ns: NS,
    materialData: Record<CorpMaterialName, CorpMaterialConstantData>,
    industryData: Record<CorpIndustryName, CorpIndustryData>,
  ) =>
  async (
    industry: CorpIndustryName,
    cityName: CityName,
    warehouseSize: number,
    outputVolume: number,
  ) => {
    const BUFFER = warehouseSize * 0.1;
    const boostVolume = warehouseSize - BUFFER - MAX_INPUT_VOLUME - outputVolume;
    const $ = inPlace(ns, ns.pid);
    const divisionName = DivisionNames[industry];
    const boostTargets = getBoostTargets(materialData, industryData, industry, boostVolume);
    for (const material of BOOST_MATERIALS) {
      const { stored } = await $.corporation['getMaterial'](divisionName, cityName, material);
      const targetAmount = boostTargets[material];
      if (stored < targetAmount) await $buy(ns)(divisionName, cityName, material, 1);
      else if (stored - targetAmount > 10)
        await $sell(ns)(divisionName, cityName, material, 1, 'MP');
      else await $buy(ns)(divisionName, cityName, material, 0);
    }
  };

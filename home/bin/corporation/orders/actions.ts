import { rmi } from '../../../lib/rmi';

export const getActions = (
  ns: NS,
  divisionName: string,
  cityName: CityName,
) => {
  const buy = async (material: CorpMaterialName, amount: number) => {
    await rmi(ns)(
      '/bin/corporation/orders/buy-material.ts',
      1,
      divisionName,
      cityName,
      material,
      amount,
    );
    await rmi(ns)(
      '/bin/corporation/orders/sell-material.ts',
      1,
      divisionName,
      cityName,
      material,
      0,
      'MP*100',
    );
  };

  const sell = async (
    material: CorpMaterialName,
    amount: number | string,
    price: string,
  ) => {
    await rmi(ns)(
      '/bin/corporation/orders/buy-material.ts',
      1,
      divisionName,
      cityName,
      material,
      0,
    );
    await rmi(ns)(
      '/bin/corporation/orders/sell-material.ts',
      1,
      divisionName,
      cityName,
      material,
      amount,
      price,
    );
  };

  const transfer = async (
    sourceDivision: string,
    sourceCity: CityName,
    targetDivision: string,
    targetCity: CityName,
    material: CorpMaterialName,
    amount: number | string,
  ) => {
    await rmi(ns)(
      '/bin/corporation/orders/cancel-export-material.ts',
      1,
      sourceDivision,
      sourceCity,
      targetDivision,
      targetCity,
      material,
    );
    await rmi(ns)(
      '/bin/corporation/orders/export-material.ts',
      1,
      sourceDivision,
      sourceCity,
      targetDivision,
      targetCity,
      material,
      amount,
    );
  };

  return {
    buy,
    sell,
    transfer,
  };
};

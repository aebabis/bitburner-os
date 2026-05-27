import { rmi } from '../../../lib/rmi';

/** @param {NS} ns
 *  @param {string} divisionName
 *  @param {CityName} cityName
 */
export const getActions = (ns, divisionName, cityName) => {
  /** @param {CorpMaterialName} material @param {number} amount */
  const buy = async (material, amount) => {
    await rmi(ns)(
      '/bin/corporation/orders/buy-material.js',
      1,
      divisionName,
      cityName,
      material,
      amount,
    );
    await rmi(ns)(
      '/bin/corporation/orders/sell-material.js',
      1,
      divisionName,
      cityName,
      material,
      0,
      'MP*100',
    );
  };

  /** @param {CorpMaterialName} material @param {number} amount @param {string} price */
  const sell = async (material, amount, price) => {
    await rmi(ns)(
      '/bin/corporation/orders/buy-material.js',
      1,
      divisionName,
      cityName,
      material,
      0,
    );
    await rmi(ns)(
      '/bin/corporation/orders/sell-material.js',
      1,
      divisionName,
      cityName,
      material,
      amount,
      price,
    );
  };

  /** @param {string} sourceDivision
   *  @param {CityName} sourceCity
   *  @param {string} targetDivision
   *  @param {CityName} targetCity
   *  @param {CorpMaterialName} material
   *  @param {number|string} amount
   **/
  const transfer = async (
    sourceDivision,
    sourceCity,
    targetDivision,
    targetCity,
    material,
    amount,
  ) => {
    await rmi(ns)(
      '/bin/corporation/orders/cancel-export-material.js',
      1,
      sourceDivision,
      sourceCity,
      targetDivision,
      targetCity,
      material,
    );
    await rmi(ns)(
      '/bin/corporation/orders/export-material.js',
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

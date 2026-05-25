import { rmi } from '../../../lib/rmi';

/** @param {NS} ns
 *  @param {string} divisionName
 *  @param {CityName} cityName
 */
export const getActions = (ns, divisionName, cityName) => {
  /** @param {CorpMaterialName} material @param {number} amount */
  const buy = async (material, amount) => {
    await rmi(ns)('/bin/corporation/orders/buy-material.js', 1, divisionName, cityName, material, amount);
    await rmi(ns)('/bin/corporation/orders/sell-material.js', 1, divisionName, cityName, material, 0, 'MP*100');
  };

  /** @param {CorpMaterialName} material @param {number} amount @param {string} price */
  const sell = async (material, amount, price) => {
    await rmi(ns)('/bin/corporation/orders/buy-material.js', 1, divisionName, cityName, material, 0);
    await rmi(ns)('/bin/corporation/orders/sell-material.js', 1, divisionName, cityName, material, amount, price);
  };
  
  return {
    buy,
    sell,
  };
};

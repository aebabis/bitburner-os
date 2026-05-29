import { rmi } from '../../../lib/rmi';

import { DivisionNames } from '../constants';

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog('ALL');

  const { officeInitialCost, warehouseInitialCost } =
    ns.corporation.getConstants();

  const RESERVE_FUNDS = 20e9;
  const SETUP_COST = officeInitialCost + warehouseInitialCost;

  const { divisions } = ns.corporation.getCorporation();

  for (const divisionName of Object.values(DivisionNames)) {
    if (divisions.includes(divisionName)) {
      const division = ns.corporation.getDivision(divisionName);
      const citiesWithoutOffice = Object.values(ns.enums.CityName).filter(
        (city) => !division.cities.includes(city),
      );
      for (const cityName of citiesWithoutOffice) {
        if (
          ns.corporation.getCorporation().funds - SETUP_COST >
          RESERVE_FUNDS
        ) {
          await rmi(ns)(
            '/bin/corporation/orders/setup-location.ts',
            1,
            divisionName,
            cityName,
            true,
          );
        }
      }
    }
  }
}

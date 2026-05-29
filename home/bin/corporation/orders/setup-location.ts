/** @param {NS} ns */
export async function main(ns) {
  const [divisionName, cityName, needsWarehouse = false] = ns.args;

  const { officeInitialCost, warehouseInitialCost } =
    ns.corporation.getConstants();

  const setupCost = needsWarehouse
    ? officeInitialCost + warehouseInitialCost
    : officeInitialCost;

  if (ns.corporation.getCorporation().funds > setupCost) {
    ns.corporation.expandCity(divisionName, cityName);
    if (needsWarehouse)
      ns.corporation.purchaseWarehouse(divisionName, cityName);
  }
}

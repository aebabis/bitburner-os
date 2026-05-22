/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  const selfFund = Boolean(ns.args[0]);

  if (!ns.corporation.hasCorporation() &&
    ns.corporation.canCreateCorporation(selfFund)) {
    ns.corporation.createCorporation('Rhizome Industries', selfFund);
  }
}

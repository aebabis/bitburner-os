export async function main(ns: NS) {
  ns.disableLog('ALL');

  const selfFund = Boolean(ns.args[0]);

  if (
    !ns.corporation.hasCorporation() &&
    ns.corporation.canCreateCorporation(selfFund)
  ) {
    ns.corporation.createCorporation('Rhizome Industries', selfFund);
  }
}

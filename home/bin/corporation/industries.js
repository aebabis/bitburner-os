const DivisionNames = {
  Agriculture: 'Rhizome Foods',
  'Water Utilities': 'Taproot Infrastructure',
};

/** @param {NS} ns @param {CorpIndustryName} industry */
const getDivision = (ns, industry) => {
  try {
    return ns.corporation.getDivision(DivisionNames[industry]);
  } catch (error) {
    return null;
  }
};

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  if (!getDivision(ns, 'Agriculture')) {
    ns.corporation.expandIndustry('Agriculture', DivisionNames['Agriculture']);
  }
}

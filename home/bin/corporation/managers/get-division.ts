export const getDivision = (ns: NS, divisionName: string) => {
  ns.disableLog('ALL');
  try {
    return ns.corporation.getDivision(divisionName);
  } catch (error) {
    return null;
  }
};

/** @param {NS} ns
 *  @param {import('../constants.js').DivisionNames} divisionName
 */
export const getDivision = (ns, divisionName) => {
  ns.disableLog('ALL');
  try {
    return ns.corporation.getDivision(divisionName);
  } catch (error) {
    return null;
  }
};

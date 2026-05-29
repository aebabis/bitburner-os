/** @param {NS} ns */
export const forecaster = (ns) => {
  return {
    record: () => {},
    getStockForecast: ns.stock.getForecast,
  };
};

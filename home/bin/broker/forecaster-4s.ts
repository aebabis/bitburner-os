export const forecaster = (ns: NS) => {
  return {
    record: () => {},
    getStockForecast: ns.stock.getForecast,
  };
};

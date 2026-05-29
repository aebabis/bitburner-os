export type Forecaster = {
  record: (data: { sym: string; price: number }) => void;
  getStockForecast: (sym: string) => number | null;
};

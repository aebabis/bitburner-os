import { by } from '../../lib/util';
import { ERROR } from '../../lib/colors';
import { putMoneyData } from '../../lib/data-store';
import { getConfig } from '../../lib/config';
import { getStocks, optimizeShares, getHoldings, getTableString } from './api';
import { getServices } from '../../lib/service-api';
import { type Forecaster } from './forecaster';

const getSpendableFunds = (ns: NS, stocks) => {
  const reserveParam = getConfig(ns).get('reserved-funds');
  const money = ns.getServerMoneyAvailable('home');
  if (reserveParam > 1) {
    // reserve is flat amount;
    return Math.max(0, money - reserveParam);
  } else {
    // reserve is proportion;
    const stockHoldings = getHoldings(stocks);
    const netWorth = money + stockHoldings;
    const allowedSpend = netWorth * (1 - reserveParam);
    return Math.max(0, allowedSpend - stockHoldings);
  }
};

const tick = (ns: NS, forecaster: Forecaster) => {
  ns.clearLog();
  const stocks = getStocks(ns);

  for (const stock of stocks) {
    forecaster.record(stock);
    stock.forecast = forecaster.getStockForecast(stock.sym);
  }

  // Sell all stocks forecast to drop
  for (const stock of stocks) {
    const [shares] = stock.position;
    if (stock.forecast < 0.5 && shares > 0) {
      if (stock.getSaleGain(shares) > 0) {
        stock.sell(shares);
      }
    }
  }

  const eligiblePurchases = stocks
    .filter((stock) => stock.forecast > 0.51)
    .filter((stock) => stock.position[0] < stock.maxShares)
    .sort(by((stock) => -stock.forecast));

  let moneyToSpend = getSpendableFunds(ns, stocks);
  while (moneyToSpend > 1e9 && eligiblePurchases.length > 0) {
    const stock = eligiblePurchases.shift();
    const maxPurchase = stock.maxShares - stock.position[0];
    const shares = optimizeShares(ns, stock, maxPurchase, moneyToSpend);
    const price = stock.buy(shares);
    moneyToSpend -= shares * price;
  }

  const estimatedStockValue = getStocks(ns)
    .map((stock) => stock.getSaleGain())
    .reduce((a, b) => a + b, 0);
  putMoneyData(ns, { estimatedStockValue });

  ns.print('EARMARKED FUNDS: $' + ns.format.number(moneyToSpend, 3));
  ns.print('ESTIMATED VALUE: $' + ns.format.number(estimatedStockValue, 3));

  ns.print(getTableString(ns, stocks));
  return stocks;
};

export const trade = async (ns: NS, forecaster: Forecaster) => {
  while (true) {
    const broker = getServices(ns).find((s) => s.name === 'broker');
    if (broker == null || broker.pid == null) return;
    try {
      const stocks = tick(ns, forecaster);
      while (
        stocks.every((stock) => ns.stock.getPrice(stock.sym) === stock.price)
      )
        await ns.sleep(250);
    } catch (error) {
      ns.tprint(ERROR + error.toString());
      await ns.sleep(10000);
    }
  }
};

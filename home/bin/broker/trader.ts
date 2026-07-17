import { by } from '../../lib/util';
import { getGoals } from '../../lib/goals/goals.ts';
import { inPlace, runInPlace } from '../../lib/in-place.ts';
import { table } from '../../lib/table.ts';
import { putMoneyData } from '../../lib/data-store.ts';

const getSpendableFunds = (ns: NS) => {
  const requiredOnHand = getGoals(ns).prerequisites('MONEY')[0]?.requirement;
  const reserveParam = typeof requiredOnHand === 'string' ? 1e9 : requiredOnHand || 1e9;
  const money = ns.getServerMoneyAvailable('home');
  return Math.max(0, money - reserveParam);
};

const $getMaxPurchase = async (ns: NS, symbol: string, maxPurchase: number, money: number) =>
  runInPlace(
    ns,
    ns.pid,
  )((symbol: string, maxPurchase: number, money: number) => {
    let min = 0;
    let max = maxPurchase;
    while (true) {
      let shares = Math.floor((min + max) / 2);
      if (min > max) return shares;
      const cost = ns.stock['getPurchaseCost'](symbol, shares, 'L');
      if (cost > money) max = shares - 1;
      else min = shares + 1;
    }
  })(symbol, maxPurchase, money);

const $getPositions = (ns: NS, symbols: string[]) =>
  runInPlace(
    ns,
    ns.pid,
  )((symbols: string[]) => {
    const result = {} as Record<string, [number, number, number, number]>;
    for (const sym of symbols) result[sym] = ns.stock['getPosition'](sym);
    return result;
  })(symbols);

const $getForecasts = (ns: NS, symbols: string[]) =>
  runInPlace(
    ns,
    ns.pid,
  )((symbols: string[]) => {
    const result = {} as Record<string, number>;
    for (const sym of symbols) result[sym] = ns.stock['getForecast'](sym);
    return result;
  })(symbols);

const $getPortfolioValue = (
  ns: NS,
  symbols: string[],
  positions: Record<string, [number, number, number, number]>,
) =>
  runInPlace(
    ns,
    ns.pid,
  )((symbols, positions) => {
    let total = 0;
    for (const sym of symbols) {
      total += ns.stock['getSaleGain'](sym, positions[sym][0], 'L');
    }
    return total;
  })(symbols, positions);

export async function main(ns: NS) {
  // Reserve RAM
  ns.stock.buyStock;

  const $ = inPlace(ns, ns.pid);
  const $rip = runInPlace(ns, ns.pid);

  const { StockMarketCommission } = ns.stock.getConstants();
  const MIN_ORDER = StockMarketCommission * 100;

  while (!(await $.stock['purchaseTixApi']())) {
    await ns.sleep(1000);
  }

  const symbols = await $.stock['getSymbols']();

  if (!(await $.stock['purchase4SMarketDataTixApi']())) {
    // If we don't yet have 4S API, we record stock value
    // and exit. This branch only exists to support accounting
    // of stocks found on the darkweb.
    const positions = await $getPositions(ns, symbols);
    const estimatedStockValue = await $getPortfolioValue(ns, symbols, positions);
    putMoneyData(ns, { estimatedStockValue });
    return;
  }

  const maxShares = await $rip((symbols: string[]) => {
    const result = {} as Record<string, number>;
    for (const sym of symbols) result[sym] = ns.stock['getMaxShares'](sym);
    return result;
  })(symbols);

  let dumpMode = false;

  while (true) {
    ns.clearLog();

    const ttc = getGoals(ns).timeToComplete() ?? 0;
    const positions = await $getPositions(ns, symbols);
    const forecasts = await $getForecasts(ns, symbols);

    if (dumpMode) dumpMode = ttc < 600;
    else dumpMode = ttc < 300;

    if (dumpMode) {
      for (const sym of symbols) {
        const [shares] = positions[sym];
        if (shares > 0) {
          if ((await $.stock['getSaleGain'](sym, shares, 'L')) > 0) {
            await $.stock['sellStock'](sym, shares);
          }
        }
      }
    } else {
      // Sell all stocks forecast to drop
      for (const sym of symbols) {
        const [shares] = positions[sym];
        if (forecasts[sym] < 0.5 && shares > 0) {
          if ((await $.stock['getSaleGain'](sym, shares, 'L')) > 0) {
            await $.stock['sellStock'](sym, shares);
          }
        }
      }

      const eligiblePurchases = symbols
        .filter((sym) => forecasts[sym] > 0.51)
        .filter((sym) => positions[sym][0] < maxShares[sym])
        .sort(by((sym) => -forecasts[sym]));

      let moneyToSpend = getSpendableFunds(ns);

      while (moneyToSpend > MIN_ORDER && eligiblePurchases.length > 0) {
        const sym = eligiblePurchases.shift()!;
        const maxPurchase = maxShares[sym] - positions[sym][0];
        const shares = await $getMaxPurchase(ns, sym, maxPurchase, moneyToSpend);
        const price = await $.stock['buyStock'](sym, shares);
        positions[sym][0] += shares;
        moneyToSpend -= shares * price;
      }
    }

    const estimatedStockValue = await $getPortfolioValue(ns, symbols, positions);
    putMoneyData(ns, { estimatedStockValue });

    ns.print('ESTIMATED VALUE: $' + ns.format.number(estimatedStockValue, 3));
    const prices = await runInPlace(
      ns,
      ns.pid,
    )((symbols: string[]) => {
      const result = {} as Record<string, number>;
      for (const sym of symbols) result[sym] = ns.stock['getPrice'](sym);
      return result;
    })(symbols);

    const columns = ['SYM', 'Shares', '+/-', 'Price'];
    const rows = symbols
      .filter((sym) => positions[sym][0] > 0)
      .map((sym) => [
        sym,
        ns.format.number(positions[sym][0]),
        forecasts[sym].toFixed(3).replace(/^0/, '') || '',
        '$' + ns.format.number(prices[sym]),
      ]);
    ns.print(table(ns, columns, rows, { colors: true }));
    await ns.stock.nextUpdate();
  }
}

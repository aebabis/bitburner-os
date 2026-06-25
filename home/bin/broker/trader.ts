import { by } from '../../lib/util';
import { getGoals } from '../../lib/goals/goals.ts';
import { inPlace, runInPlace } from '../../lib/in-place.ts';
import { table } from '../../lib/table.ts';
import { putMoneyData } from '../../lib/data-store.ts';

const getSpendableFunds = (ns: NS) => {
  const requiredOnHand = getGoals(ns).prerequisites('MONEY')[0]?.requirement;
  const reserveParam = requiredOnHand || 1e9;
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
  while (!(await $.stock['purchase4SMarketDataTixApi']())) {
    await ns.sleep(1000);
  }

  const symbols = await $.stock['getSymbols']();

  const maxShares = await $rip((symbols: string[]) => {
    const result = {} as Record<string, number>;
    for (const sym of symbols) result[sym] = ns.stock['getMaxShares'](sym);
    return result;
  })(symbols);

  while (true) {
    ns.clearLog();

    const positions = await runInPlace(
      ns,
      ns.pid,
    )((symbols: string[]) => {
      const result = {} as Record<string, [number, number, number, number]>;
      for (const sym of symbols) result[sym] = ns.stock['getPosition'](sym);
      return result;
    })(symbols);

    const forecasts = await runInPlace(
      ns,
      ns.pid,
    )((symbols: string[]) => {
      const result = {} as Record<string, number>;
      for (const sym of symbols) result[sym] = ns.stock['getForecast'](sym);
      return result;
    })(symbols);

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

    const estimatedStockValue = await $rip((symbols, positions) => {
      let total = 0;
      for (const sym of symbols) {
        total += ns.stock['getSaleGain'](sym, positions[sym][0], 'L');
      }
      return total;
    })(symbols, positions);

    ns.print('ESTIMATED VALUE: $' + ns.format.number(estimatedStockValue, 3));
    putMoneyData(ns, { estimatedStockValue });

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
        forecasts[sym].toFixed(3) || '',
        '$' + ns.format.number(prices[sym]),
      ]);
    ns.print(table(ns, columns, rows, { colors: true }));
    await ns.stock.nextUpdate();
  }
}

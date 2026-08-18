import { by, formatTime } from '../../lib/util';
import { getGoals } from '../../lib/goals/goals.ts';
import { inPlace, runInPlace } from '../../lib/in-place.ts';
import { table } from '../../lib/table.ts';
import {
  getMoneyData,
  getPlayerData,
  getStaticData,
  putMoneyData,
  putPlayerData,
} from '../../lib/data-store.ts';
import { usingCorp } from '../../lib/query-service.ts';
import { getServices } from '../../lib/service-api.ts';

const getRequiredReserves = (ns: NS) => {
  const staticData = getStaticData(ns);
  const { graftPriceReserve = 0 } = getMoneyData(ns);
  const casinoService = getServices(ns)?.find(({ name }) => name === 'casino');
  if (casinoService?.allowed) return 50e6 + graftPriceReserve;
  if (!ns.corporation.hasCorporation() && usingCorp(staticData, getPlayerData(ns))) {
    return 150e9 + graftPriceReserve;
  }
  const requiredOnHand = getGoals(ns).prerequisites('MONEY')[0]?.requirement ?? 0;
  return requiredOnHand + graftPriceReserve;
};

const getSpendableFunds = (ns: NS) => {
  const reserveFunds = getRequiredReserves(ns);
  const money = ns.getServerMoneyAvailable('home');
  return Math.max(0, money - reserveFunds);
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
  ns.disableLog('ALL');
  const { resetInfo } = getStaticData(ns);
  const inBN8 = resetInfo.currentNode === 8;
  if (inBN8) {
    ns.ui.openTail();
    putMoneyData(ns, { stockIncome: 1 });
  }

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
    const reportDataRows = [] as string[][];

    const { currentWork, graftCompletionTime = 0 } = getPlayerData(ns);
    const isGrafting = currentWork?.type === 'GRAFTING' && graftCompletionTime > Date.now();
    const graftTime = isGrafting ? (graftCompletionTime - Date.now()) / 1000 : 0;

    const goalTTC = getGoals(ns).timeToComplete();
    const ttc = Math.max(goalTTC, graftTime);
    const positions = await $getPositions(ns, symbols);
    const forecasts = await $getForecasts(ns, symbols);
    let estimatedStockValue = await $getPortfolioValue(ns, symbols, positions);

    if (dumpMode) dumpMode = ttc < 600;
    else dumpMode = ttc < 300;

    reportDataRows.push(['Est TTC', formatTime(ttc)]);

    const sellIfProfitable = async (sym: string) => {
      const [shares] = positions[sym];
      if (shares === 0) return;
      const saleGain = await $.stock['getSaleGain'](sym, shares, 'L');
      if (saleGain > 0) {
        positions[sym][0] = 0;
        estimatedStockValue = Math.max(0, estimatedStockValue - saleGain);
        putMoneyData(ns, { estimatedStockValue });
        await $.stock['sellStock'](sym, shares);
      }
    };

    if (dumpMode) {
      for (const sym of symbols) await sellIfProfitable(sym);
    } else {
      // Sell all stocks forecast to drop
      for (const sym of symbols) {
        if (forecasts[sym] < 0.5) await sellIfProfitable(sym);
      }

      const eligiblePurchases = symbols
        .filter((sym) => forecasts[sym] > 0.51)
        .filter((sym) => positions[sym][0] < maxShares[sym])
        .sort(by((sym) => -forecasts[sym]));

      let moneyToSpend = getSpendableFunds(ns);
      reportDataRows.push(['Spendable', '$' + ns.format.number(moneyToSpend)]);

      while (moneyToSpend > MIN_ORDER && eligiblePurchases.length > 0) {
        const sym = eligiblePurchases.shift()!;
        const maxPurchase = maxShares[sym] - positions[sym][0];
        const shares = await $getMaxPurchase(ns, sym, maxPurchase, moneyToSpend);
        const price = await $.stock['buyStock'](sym, shares);
        if (price !== 0) {
          positions[sym][0] += shares;
          estimatedStockValue += await $.stock['getSaleGain'](sym, shares, 'L');
          moneyToSpend -= shares * price;
        }
      }
    }

    putMoneyData(ns, { estimatedStockValue });
    putPlayerData(ns, { player: ns.getPlayer() });

    if (inBN8) {
      const { casinoEarnings = 0 } = getMoneyData(ns);
      const player = await $['getPlayer']();
      // In BN8, stocks and gambling are the only sources of income
      // and money is not spent during an install cycle. Determining
      // earnings empirically is easier than tracking stock profits
      // across multiple purchases.
      const gains = estimatedStockValue + player.money - 250e6 - casinoEarnings;
      const time = (Date.now() - resetInfo.lastAugReset) / 1000;
      const stockIncome = Math.max(1, gains / time);
      putMoneyData(ns, { stockIncome });
    }

    reportDataRows.push(['Estimated Value', '$' + ns.format.number(estimatedStockValue, 3)]);
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
    ns.clearLog();
    ns.print('\n');
    ns.print(table(ns, null, reportDataRows));
    ns.print('\n');
    ns.print(table(ns, columns, rows, { colors: true }));
    ns.print('\n');
    await ns.stock.nextUpdate();
  }
}

import { putMoneyData } from '../lib/data-store';

// https://www.reddit.com/r/Bitburner/comments/rsqffz/bitnode_8_stockmarket_algo_trader_script_without/
const samplingLength = 30;

function predictState(samples: number[]) {
  const limits = [
    null,
    null,
    null,
    4,
    5,
    6,
    6,
    7,
    8,
    8,
    9,
    10,
    10,
    11,
    11,
    12,
    12,
    13,
    14,
    14,
    15,
    15,
    16,
    16,
    17,
    17,
    18,
    19,
    19,
    20,
  ];
  let inc = 0;
  for (let i = 0; i < samples.length; ++i) {
    const total = i + 1;
    const idx = samples.length - total;
    if (samples[idx] > 1) {
      ++inc;
    }
    const limit = limits[i];
    if (limit === null) {
      continue;
    }
    if (inc >= limit) {
      return 1;
    }
    if (total - inc >= limit) {
      return -1;
    }
  }
  return 0;
}

function format(money: number) {
  const prefixes = ['', 'k', 'm', 'b', 't', 'q'];
  for (let i = 0; i < prefixes.length; i++) {
    if (Math.abs(money) < 1000) {
      return `${Math.floor(money * 10) / 10}${prefixes[i]}`;
    } else {
      money /= 1000;
    }
  }
  return `${Math.floor(money * 10) / 10}${prefixes[prefixes.length - 1]}`;
}

function posNegDiff(samples: number[]) {
  const pos = samples.reduce((acc, curr) => acc + (curr > 1 ? 1 : 0), 0);
  return Math.abs(samples.length - 2 * pos);
}

function posNegRatio(samples: number[]) {
  const pos = samples.reduce((acc, curr) => acc + (curr > 1 ? 1 : 0), 0);
  return Math.round(100 * ((2 * pos) / samples.length - 1));
}

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.ui.openTail();
  const commission = ns.stock.getConstants().StockMarketCommission;
  const symLastPrice: Record<string, number> = {};
  const symChanges: Record<string, number[]> = {};
  for (const sym of ns.stock.getSymbols()) {
    symLastPrice[sym] = ns.stock.getPrice(sym);
    symChanges[sym] = [];
  }

  let startTime = Date.now();
  let totalProfit = 0;

  while (true) {
    for (const sym of ns.stock.getSymbols()) {
      const current = ns.stock.getPrice(sym);
      symChanges[sym].push(current / symLastPrice[sym]);
      symLastPrice[sym] = current;
      if (symChanges[sym].length > samplingLength) {
        symChanges[sym] = symChanges[sym].slice(symChanges[sym].length - samplingLength);
      }
    }

    const prioritizedSymbols = [...ns.stock.getSymbols()];
    prioritizedSymbols.sort((a, b) => posNegDiff(symChanges[b]) - posNegDiff(symChanges[a]));

    for (const sym of prioritizedSymbols) {
      const [longShares, longPrice, shortShares, shortPrice] = ns.stock.getPosition(sym);
      const state = predictState(symChanges[sym]);
      const ratio = posNegRatio(symChanges[sym]);
      const bidPrice = ns.stock.getBidPrice(sym);
      const askPrice = ns.stock.getAskPrice(sym);
      if (longShares <= 0 && shortShares <= 0 && ns.stock.getPrice(sym) < 30000) {
        continue;
      }

      if (longShares > 0) {
        const cost = longShares * longPrice;
        const profit = longShares * (bidPrice - longPrice) - 2 * commission;
        if (state < 0) {
          const sellPrice = ns.stock.sellStock(sym, longShares);
          totalProfit += profit;
          if (sellPrice > 0) {
            ns.print(`SOLD (long) ${sym}. Profit: ${format(profit)}`);
          }
        } else {
          ns.print(
            `${sym} (${ratio}): ${format(profit + cost)} / ${format(profit)} (${Math.round((profit / cost) * 10000) / 100}%)`,
          );
        }
      } else if (shortShares > 0) {
        const cost = shortShares * shortPrice;
        const profit = shortShares * (shortPrice - askPrice) - 2 * commission;
        if (state > 0) {
          const sellPrice = ns.stock.sellShort(sym, shortShares);
          totalProfit += profit;
          if (sellPrice > 0) {
            ns.print(`SOLD (short) ${sym}. Profit: ${format(profit)}`);
          }
        } else {
          ns.print(
            `${sym} (${ratio}): ${format(profit + cost)} / ${format(profit)} (${Math.round((profit / cost) * 10000) / 100}%)`,
          );
        }
      } else {
        const money = ns.getServerMoneyAvailable('home');
        if (state > 0) {
          const sharesToBuy = Math.min(
            10000,
            ns.stock.getMaxShares(sym),
            Math.floor((money - commission) / askPrice),
          );
          if (ns.stock.buyStock(sym, sharesToBuy) > 0) {
            ns.print(`BOUGHT (long) ${sym}.`);
          }
        } else if (state < 0) {
          const sharesToBuy = Math.min(
            10000,
            ns.stock.getMaxShares(sym),
            Math.floor((money - commission) / bidPrice),
          );
          if (ns.stock.buyShort(sym, sharesToBuy) > 0) {
            ns.print(`BOUGHT (short) ${sym}.`);
          }
        }
      }
    }
    let estimatedStockValue = 0;
    for (const symbol of ns.stock.getSymbols()) {
      const [long, , short] = ns.stock.getPosition(symbol);
      estimatedStockValue += ns.stock.getSaleGain(symbol, long, 'L');
      estimatedStockValue += ns.stock.getSaleGain(symbol, short, 'S');
    }
    const stockIncome = totalProfit / ((Date.now() - startTime) / 1000);
    putMoneyData(ns, { estimatedStockValue, stockIncome });
    await ns.stock.nextUpdate();
  }
}

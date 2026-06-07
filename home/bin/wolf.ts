import { rmi } from '../lib/rmi';
import { table } from '../lib/table';
import { by } from '../lib/util';

const DRAWER_WIDTH =
  globalThis['document'].querySelector('.MuiDrawer-root')?.clientWidth ?? 248;

type TickerSnapshot = {
  symbol: string;
  price: number;
  askPrice: number;
  bidPrice: number;
  forecast: number;
};

const getTicker = (ns: NS) => {
  let ticks = 0;
  const history: TickerSnapshot[][] = [];
  const getMap = (snapshot: TickerSnapshot[]) =>
    snapshot.reduce<Record<string, TickerSnapshot>>((map, entry) => {
      map[entry.symbol] = entry;
      return map;
    }, {});
  return {
    tick: () => {
      ticks++;
      history.push(
        ns.stock.getSymbols().map((symbol) => {
          const askPrice = ns.stock.getAskPrice(symbol);
          const bidPrice = ns.stock.getBidPrice(symbol);
          return {
            symbol,
            price: (askPrice + bidPrice) / 2,
            askPrice,
            bidPrice,
            forecast: ns.stock.has4SDataTixApi()
              ? ns.stock.getForecast(symbol)
              : 0.5,
          };
        }),
      );
      while (history.length > 10000) {
        history.shift();
      }
    },
    getForecasts: () => {
      if (ns.stock.has4SDataTixApi()) {
        throw new Error("Don't use this algorithm if you have 4S");
      }
      if (history.length < 20) {
        return null;
      }
      const old10 = history.slice(-20, -10).map(getMap);
      const new10 = history.slice(-10).map(getMap);
      return Object.fromEntries(
        ns.stock.getSymbols().map((symbol) => {
          const oldAvg =
            old10
              .map((snapshots) => snapshots[symbol])
              .map((snapshot) => snapshot.price)
              .reduce((a, b) => a + b, 0) / 10;
          const newAvg =
            new10
              .map((snapshots) => snapshots[symbol])
              .map((snapshot) => snapshot.price)
              .reduce((a, b) => a + b, 0) / 10;
          const change = newAvg / oldAvg;
          return [symbol, change] as [string, number];
        }),
      );
    },
    getNumTicks: () => ticks,
  };
};

const getPurchaseLimit = (
  ns: NS,
  symbol: string,
  type: PositionType = ns.enums.PositionType.Long,
) => {
  const money = ns.getServerMoneyAvailable('home');
  const [longShares, , shortShares] = ns.stock.getPosition(symbol);
  let lower = 0;
  let upper = ns.stock.getMaxShares(symbol) - longShares - shortShares;
  while (lower < upper) {
    const mid = Math.floor((lower + upper) / 2);
    const cost = ns.stock.getPurchaseCost(symbol, mid, type);
    if (cost <= money) {
      lower = mid + 1;
    } else {
      upper = mid - 1;
    }
  }
  return upper;
};

const getPorfolioValue = (ns: NS) =>
  ns.stock
    .getSymbols()
    .map(ns.stock.getPosition)
    .map(
      ([longShares, longAvg, shortShares, shortAvg]) =>
        longShares * longAvg + shortShares * shortAvg,
    )
    .reduce((a, b) => a + b, 0);

const printSpreadTable = (ns: NS) => {
  const money = (n: number) => `${ns.format.number(n, 3)}`;
  const columns = ['SYMBOL', 'BID', 'PRICE', 'ASK', 'SPREAD', 'SPREAD/PRICE'];
  const rows = ns.stock.getSymbols().map((symbol) => {
    const bidPrice = ns.stock.getBidPrice(symbol);
    const askPrice = ns.stock.getAskPrice(symbol);
    const price = (bidPrice + askPrice) / 2;
    const spread = askPrice - bidPrice;
    const spreadProp = spread / price;
    return [
      symbol,
      money(bidPrice),
      money(price),
      money(askPrice),
      money(spread),
      ns.format.number(spreadProp * 100) + '%',
    ];
  });
  ns.print(table(ns, columns, rows, { colors: true }) + '\n');
};

const printPositionTable = (ns: NS) => {
  const money = (n: number) => `${ns.format.number(n, 3)}`;
  const columns = [
    'SYMBOL',
    'POSITION',
    'SHARES',
    'AVG PRICE',
    'MKT PRICE',
    'PURCHASE VALUE',
    'SELL PRICE',
  ];
  const rows = ns.stock
    .getSymbols()
    .map(
      (symbol) =>
        [symbol, ...ns.stock.getPosition(symbol)] as [
          string,
          number,
          number,
          number,
          number,
        ],
    )
    .filter((position) => position[1] || position[3])
    .flatMap(([symbol, longS, long$, shortS, short$]) => {
      const result = [];
      if (longS) {
        const price = ns.stock.getBidPrice(symbol);
        const sell = ns.stock.getSaleGain(symbol, longS, 'L');
        result.push([
          symbol,
          'LONG',
          longS,
          money(long$),
          money(price),
          money(longS * long$),
          money(sell),
        ]);
      }
      if (shortS) {
        const price = ns.stock.getAskPrice(symbol);
        const sell = ns.stock.getSaleGain(symbol, shortS, 'S');
        result.push([
          symbol,
          'SHORT',
          shortS,
          money(short$),
          money(price),
          money(shortS * short$),
          money(sell),
        ]);
      }
      return result;
    });
  ns.print(table(ns, columns, rows, { colors: true }) + '\n');
};

const printOrdersTable = (ns: NS) => {
  const orders = ns.stock.getOrders();
  const money = (n: number) => `${ns.format.number(n, 3)}`;
  const columns = ['SYMBOL', 'TYPE', 'SHARES', 'POSITION', 'TRIGGER'];
  const rows = ns.stock
    .getSymbols()
    .flatMap((symbol) =>
      (orders[symbol] ?? []).map((order) => [
        symbol,
        order.type,
        order.shares,
        order.position,
        money(order.price),
      ]),
    );
  ns.print(table(ns, columns, rows, { colors: true }) + '\n');
};

const RESET_THRESHOLD = 240e6;

export async function main(ns: NS) {
  ns.disableLog('ALL');

  const { StockMarketCommission } = ns.stock.getConstants();
  const MIN_ORDER = StockMarketCommission * 100;

  ns.ui.openTail();
  ns.ui.moveTail(DRAWER_WIDTH, 2);
  ns.ui.resizeTail(600, 400);

  const ticker = getTicker(ns);

  while (true) {
    const porfolioValue = getPorfolioValue(ns);
    const netWorth = porfolioValue + ns.getServerMoneyAvailable('home');
    if (netWorth < RESET_THRESHOLD) {
      await rmi(ns)('bin/self/aug/reset.ts');
    }
    ns.clearLog();

    ticker.tick();

    if (ns.stock.has4SDataTixApi()) {
      // TODO
    } else {
      // const growth = ticker.getGrowth();
      const forecasts = ticker.getForecasts();
      ns.print('TICK:    ' + ticker.getNumTicks());
      if (forecasts) {
        const changes = Object.entries(forecasts);
        const rising = changes.filter(([, change]) => change >= 1.02);
        const falling = changes.filter(([, change]) => change <= 0.98);
        const doneEarning = changes.filter(([, change]) => change <= 1);
        const doneLosing = changes.filter(([, change]) => change >= 1);

        for (const [symbol] of doneEarning) {
          const [long, ,] = ns.stock.getPosition(symbol);
          if (long > 0) {
            ns.stock.sellStock(symbol, long);
          }
        }
        for (const [symbol] of doneLosing) {
          const [, , short] = ns.stock.getPosition(symbol);
          if (short > 0) {
            ns.stock.sellShort(symbol, short);
          }
        }
        for (const [symbol] of rising.sort(by(([, value]) => -value))) {
          const amount = getPurchaseLimit(ns, symbol);
          if (ns.stock.getPurchaseCost(symbol, amount, 'L') > MIN_ORDER) {
            ns.stock.buyStock(symbol, amount);
          }
        }
        for (const [symbol] of falling.sort(by(([, value]) => value))) {
          const amount = getPurchaseLimit(ns, symbol, 'S');
          if (ns.stock.getPurchaseCost(symbol, amount, 'S') > MIN_ORDER) {
            ns.stock.buyShort(symbol, amount);
          }
        }
      }
    }

    printSpreadTable(ns);
    ns.print('\n');
    printPositionTable(ns);
    ns.print('\n');
    printOrdersTable(ns);

    await ns.stock.nextUpdate();
  }
}

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
  const history: TickerSnapshot[][] = [];
  const getMap = (snapshot: TickerSnapshot[]) =>
    snapshot.reduce<Record<string, TickerSnapshot>>((map, entry) => {
      map[entry.symbol] = entry;
      return map;
    }, {});
  return {
    tick: () => {
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
    getGrowth: () => {
      if (ns.stock.has4SDataTixApi()) {
        throw new Error("Don't use this algorithm if you have 4S");
      }
      const start = getMap(history[0]);
      const end = getMap(history[history.length - 1]);
      if (start == null) {
        throw new Error('getGrowth called before initial tick()');
      }
      return ns.stock
        .getSymbols()
        .map(
          (symbol) =>
            [
              symbol,
              (start[symbol].price - end[symbol].price) / end[symbol].price,
            ] as [string, number],
        )
        .sort(by(([, growth]) => growth));
    },
  };
};

const getPurchaseLimit = (
  ns: NS,
  symbol: string,
  type = ns.enums.PositionType.Long,
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
      const growth = ticker.getGrowth();
      const hasGrowthData = growth.some(([, growth]) => growth !== 0);
      if (hasGrowthData) {
        for (const [symbol] of growth.slice().reverse()) {
          const amount = getPurchaseLimit(ns, symbol);
          if (ns.stock.getPurchaseCost(symbol, amount, 'L') > MIN_ORDER) {
            if (ns.stock.buyStock(symbol, amount)) {
              const [long] = ns.stock.getPosition(symbol);
              const currentSellPrice = ns.stock.getBidPrice(symbol);
              ns.stock.placeOrder(
                symbol,
                long,
                0.99 * currentSellPrice,
                ns.enums.OrderType.StopSell,
                'L',
              );
              ns.stock.placeOrder(
                symbol,
                long,
                1.02 * currentSellPrice,
                ns.enums.OrderType.LimitSell,
                'L',
              );
            }
          }
        }
      }
    }

    const openOrders = ns.stock.getOrders();
    for (const symbol of ns.stock.getSymbols()) {
      for (const order of openOrders[symbol] ?? []) {
        const [long, , short] = ns.stock.getPosition(symbol);
        const isOrderMoot = order.position === 'L' ? long === 0 : short === 0;
        if (isOrderMoot) {
          ns.stock.cancelOrder(
            symbol,
            order.shares,
            order.price,
            order.type,
            order.position,
          );
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

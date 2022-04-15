import { by } from './lib/util';
import getConfig from './lib/config';

/** @param {NS} ns **/
const getStocks = (ns) => ns.stock.getSymbols().map(sym => ({
    sym,
    forecast: ns.stock.getForecast(sym),
    maxShares: ns.stock.getMaxShares(sym),
    position: ns.stock.getPosition(sym),
    price: ns.stock.getPrice(sym),
    volatility: ns.stock.getVolatility(sym),
    getPurchaseCost: (shares) => ns.stock.getPurchaseCost(sym, shares, 'Long'),
    getSaleGain: (shares) => ns.stock.getSaleGain(sym, shares, 'Long'),
    buy: (shares) => ns.stock.buy(sym, shares),
    sell: (shares) => ns.stock.sell(sym, shares),
}));

/** @param {NS} ns **/
const optimizeShares = async (ns, stock, maxPurchase, money) => {
    let min = 0;
    let max = maxPurchase;
    while (true) {
        let shares = Math.floor((min + max) / 2);
        if (min > max)
            return shares;
        const cost = await stock.getPurchaseCost(shares);
        if (cost > money)
            max = shares - 1;
        else
            min = shares + 1;
    }
}

const getHoldings = (stocks) => stocks.map(stock => stock.position[0] * stock.position[1])
        .reduce((a,b)=>a+b,0);

/** @param {NS} ns **/
const getSpendableFunds = async (ns, stocks) => {
    const reserveParam = getConfig(ns).get('reserved-funds');
    const money = ns.getServerMoneyAvailable('home');
    if (reserveParam > 1) { // reserve is flat amount;
        return Math.max(0, money - reserveParam);
    } else { // reserve is proportion;
        const stockHoldings = getHoldings(stocks);
        const netWorth = money + stockHoldings;
        const allowedSpend = netWorth * (1 - reserveParam);
        return Math.max(0, allowedSpend - stockHoldings);
    }
}

/** @param {NS} ns **/
const broker = async(ns) => {
    while (true) {
        ns.clearLog();
        const stocks = getStocks(ns);
        
        // Sell all stocks forecast to drop
        await Promise.all(stocks.map(async (stock) => {
            const [shares] = stock.position;
            if (stock.forecast < .5 && shares > 0) {
                if (await stock.getSaleGain(shares) > 0) {
                    await stock.sell(shares);
                }
            }
        }));

        const eligiblePurchases = stocks
            .filter(stock=>stock.forecast > .51)
            .filter(stock=>stock.position[0] < stock.maxShares)
            .sort(by(stock=>-stock.forecast));
    
        let moneyToSpend = await getSpendableFunds(ns, stocks);
        ns.print('EARMARKED FUNDS: ' + ns.nFormat(moneyToSpend, '0.000a'));
        while (moneyToSpend > 1e9 && eligiblePurchases.length > 0) {
            const stock = eligiblePurchases.shift();
            const maxPurchase = stock.maxShares - stock.position[0];
            const shares = await optimizeShares(ns, stock, maxPurchase, moneyToSpend);
            const price = await stock.buy(shares);
            moneyToSpend -= shares * price;
        }

        const h1 = 'SYM'.padEnd(5);
        const h2 = 'Shares'.padEnd(10);
        const h3 = '+/-'.padEnd(4);
        const h4 = 'Price';
        const lines = stocks
            .filter(stock=>stock.position[0] > 0)
            .map((stock) => {
                const sym = stock.sym.padEnd(5);
                const position = stock.position[0].toString().padEnd(10);
                const forecast = stock.forecast.toFixed(3).toString().slice(1);
                return sym + ' ' + position + ' ' + forecast + ' ' + stock.price.toFixed(2);
            });
        const maxLength = lines.map(l=>l.length).reduce((a,b)=>a>b?a:b,0);
        ns.print('-'.repeat(maxLength));
        ns.print(`${h1} ${h2} ${h3} ${h4}`);
        ns.print(lines.join('\n'));
    
        await ns.sleep(5000);
    }

}

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    const [command, param] = ns.args;
    if (command == null) {
        await broker(ns);
    } else {
        switch (command) {
            case 'reserve':
                if (param > 1) {
                    ns.tprint(`Setting reserve amount to ${param}`);
                } else {
                    ns.tprint(`Setting reserve proportion to ${param}`);
                }
                getConfig(ns).set('reserved-funds', param);
                return;
            case 'invest':
                // TODO: Invest flat amount once. Shouldn't need to adjust param
                return;
            case 'withdraw':
                // TODO: Sell stocks to make amount
                // If necessary, raise reserve param to prevent auto-reinvestment
                return;
            case 'dump':
                const stocks = getStocks(ns);
                ns.tprint(`Selling all holdings and setting reserve proportion to 100%`);
                getConfig(ns).set('reserved-funds', 1);
                for (const stock of stocks)
                    stock.sell(stock.position[0]);
                return;
            case 'help':
                // TODO: Maybe
                return;
        }
    }
}
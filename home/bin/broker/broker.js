import { AnyHostService } from './lib/service';
import { getTableString } from './lib/service-api';
import { getMoneyData } from './lib/data-store';
import { rmi } from './lib/rmi';

const isTixViable = (ns) => {
    const { costToAug } = getMoneyData(ns);
    const { money } = ns.getPlayer();
    if (costToAug > 5e9)
        return money > 1e9;
    else
        return money - costToAug > 1e9;
};

const is4SViable = (ns) => {
    const { costToAug } = getMoneyData(ns);
    const { money } = ns.getPlayer();
    if (costToAug > 5e9)
        return money > 1e9;
    else
        return money - costToAug > 1e9;
};

const getTixApiAccess = async (ns) => {
    while (!ns.getPlayer().hasTixApiAccess) {
        while (!isTixViable(ns))
            await ns.sleep(1000);
        if (!ns.getPlayer().hasWseAccess)
            await rmi(ns)('/broker/purchase.js', 'purchaseWseAccount');
        await rmi(ns)('/broker/purchase.js', 'purchaseTixApi');
    }
};

const loadStaticStockData = (ns) => rmi(ns, true)('/bin/load-stocks.js');

const attempt4SApiAccess = async (ns) => {
    if (is4SViable(ns))
        await rmi(ns)('/broker/purchase.js', 'purchase4SMarketDataTixApi');
};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');

    const isTrendTrader = (player=ns.getPlayer()) => player.hasTixApiAccess && !player.has4SDataTixApi;
    const isFourSTrader = (player=ns.getPlayer()) => player.hasTixApiAccess && player.has4SDataTixApi;

    const trendTraderSubservice = AnyHostService(ns, isTrendTrader)('/bin/broker/trader-trend.js');
    const fourSTraderSubservice = AnyHostService(ns, isFourSTrader)('/bin/broker/trader-4s.js');

    await getTixApiAccess();
    await loadStaticStockData();

    while (true) {
        if (!ns.getPlayer().has4SDataTixApi)
            await attempt4SApiAccess();
        await trendTraderSubservice.check();
        await fourSTraderSubservice.check();
        const subserviceData = [
            trendTraderSubservice.getData(),
            fourSTraderSubservice.getData(),
        ];
        ns.clearLog();
        ns.print(getTableString(ns, subserviceData));
    }
}

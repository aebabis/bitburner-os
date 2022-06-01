import { AnyHostService } from './lib/service';
import { getTableString } from './lib/service-api';
import { getMoneyData } from './lib/data-store';
import { rmi } from './lib/rmi';

const isTixViable = (ns) => {
    const { costToAug } = getMoneyData(ns);
    const { money } = ns.getPlayer();
    if (costToAug == null || costToAug > 5e9)
        return money > 5e9;
    else
        return money - costToAug > 5e9;
};

const is4SViable = (ns) => {
    const { costToAug } = getMoneyData(ns);
    const { money } = ns.getPlayer();
    if (costToAug > 25e9)
        return money > 25e9;
    else
        return money - costToAug > 25e9;
};

const getTixApiAccess = async (ns) => {
    while (!ns.getPlayer().hasTixApiAccess) {
        while (!isTixViable(ns))
            await ns.sleep(1000);
        if (!ns.getPlayer().hasWseAccess)
            await rmi(ns)('/bin/broker/purchase.js', 1, 'purchaseWseAccount');
        await rmi(ns)('/bin/broker/purchase.js', 1, 'purchaseTixApi');
    }
};

const loadStaticStockData = (ns) => rmi(ns, true)('/bin/broker/load-stocks.js');

const attempt4SApiAccess = async (ns) => {
    if (is4SViable(ns))
        await rmi(ns)('/bin/broker/purchase.js', 1, 'purchase4SMarketDataTixApi');
};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');

    const isTrendTrader = (ns, player=ns.getPlayer()) => player.hasTixApiAccess && !player.has4SDataTixApi;
    const isFourSTrader = (ns, player=ns.getPlayer()) => player.hasTixApiAccess && player.has4SDataTixApi;

    const trendTraderSubservice = AnyHostService(ns, isTrendTrader)('/bin/broker/trader-trend.js');
    const fourSTraderSubservice = AnyHostService(ns, isFourSTrader)('/bin/broker/trader-4s.js');
    const services = [trendTraderSubservice, fourSTraderSubservice];

    await getTixApiAccess(ns);
    await loadStaticStockData(ns);

    while (true) {
        if (!ns.getPlayer().has4SDataTixApi)
            await attempt4SApiAccess(ns);
        
        for (const service of services)
            await service.check();

        ns.clearLog();
        ns.print(getTableString(ns, services.map(s=>s.toData())));

        await ns.sleep(1000);
    }
}
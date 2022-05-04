import { disableService } from './lib/service-api';

/** @param {NS} ns */
export async function main(ns) {
    if (!ns.stock.purchaseWseAccount())
        return;
    if (!ns.stock.purchaseTixApi())
        return;
    if (!ns.stock.purchase4SMarketData())
        return;
    if (!ns.stock.purchase4SMarketDataTixApi())
        return;
    const serviceName = ns.getScriptName().split('/').pop().split('.').shift();
    disableService(ns, serviceName);
}
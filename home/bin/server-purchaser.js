import { PURCHASE_THREADPOOL } from './etc/filenames';
import { logger } from './lib/logger';
import { getRamData, getMoneyData, getStaticData } from './lib/data-store';
import { disableService } from './lib/service-api';
import { rmi } from './lib/rmi';

/** @param {NS} ns **/
const getServerNames = (maxServers) => {
    return new Array(maxServers).fill(null)
        .map((_,i) => (i+1).toString().padStart(2, '0'))
        .map(n => `THREADPOOL-${n}`);
}

/** @param {NS} ns **/
const getPurchasedServerRams = (ns, maxServers) => {
    return getServerNames(maxServers).map((hostname) => {
        try {
            return { 
                hostname,
                ram: ns.getServerMaxRam(hostname),
            };
        } catch {
            return null
        }
    }).filter(Boolean);
}

/** @param {NS} ns **/
const atCapacity = (ns) => {
    const ramData = getRamData(ns);
    if (ramData == null)
        return false;

    const { totalRamUsed, totalMaxRam, ramQueued } = ramData;

    // Allow a 20% buffer
    return totalRamUsed + ramQueued > totalMaxRam * .8;
}

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    const console = logger(ns);

    const buy = async (...args) => {
        try {
            await rmi(ns)(PURCHASE_THREADPOOL, 1, ...args);
        } catch (error) {
            await console.error(error);
        }
    }

    while (true) {
        await ns.sleep(50);

        const {
            purchasedServerLimit,
            purchasedServerCosts,
            purchasedServerMaxRam,
        } = getStaticData(ns);

        const purchasedServers = getPurchasedServerRams(ns, purchasedServerLimit);
        if (purchasedServers.length === purchasedServerLimit &&
            purchasedServers.every(server=>server.ram === purchasedServerMaxRam)) {
            disableService(ns, 'server-purchaser');
            return;
        }

        const money = ns.getServerMoneyAvailable('home');

        const atMaxServers = purchasedServers.length === purchasedServerLimit;
        const smallest = purchasedServers[purchasedServers.length - 1];

        let lowerBound = 4;
        if (atMaxServers)
            lowerBound = smallest.ram * 2;

        if (purchasedServerCosts[lowerBound] < money)
            continue;

        const [jobServer] = purchasedServers;
        const jobServerRam = jobServer?.ram;
        if (jobServerRam < 256 && ram > jobServerRam) {
            await buy(ram, jobServer.hostname);
            continue;
        }

        if (!atCapacity(ns))
            continue;

        // Don't buy a server we'll replace right away
        if (ram < purchasedServerMaxRam && purchasedServerCosts[ram] < getMoneyData(ns).income5s)
            continue;

        if (atMaxServers)
            await buy(ram, smallest.hostname);
        else
            await buy(ram);
    }
}
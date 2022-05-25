import { THREADPOOL } from './etc/config';
import { PURCHASE_THREADPOOL } from './etc/filenames';
import { logger } from './lib/logger';
import { getRamData, getMoneyData, getStaticData } from './lib/data-store';
import { disableService } from './lib/service-api';
import { rmi } from './lib/rmi';
import { estimateTimeToGoal, needsJobRam, getJobRamCost } from './lib/query-service';

/** @param {NS} ns **/
const getServerNames = (maxServers) => {
    return new Array(maxServers).fill(null)
        .map((_,i) => (i+1).toString().padStart(2, '0'))
        .map(n => `${THREADPOOL}-${n}`);
};

/** @param {NS} ns **/
const getPurchasedServerRams = (ns, maxServers) => {
    return getServerNames(maxServers).map((hostname) => {
        try {
            return { 
                hostname,
                ram: ns.getServerMaxRam(hostname),
            };
        } catch {
            return null;
        }
    }).filter(Boolean);
};

/** @param {NS} ns **/
const atCapacity = (ns) => {
    const ramData = getRamData(ns);
    if (ramData == null)
        return false;

    const { totalRamUsed, totalMaxRam, ramQueued } = ramData;

    // Allow a 20% buffer
    return totalRamUsed + ramQueued > totalMaxRam * .8;
};

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    const console = logger(ns);

    const buyServer = async (...args) => {
        try {
            await rmi(ns)(PURCHASE_THREADPOOL, 1, ...args);
        } catch (error) {
            await console.error(error);
        }
    };

    const getSmallestServer = (servers) => {
        if (servers.length === 0)
            return null;
        if (servers.length === 1)
            return servers[0];
        return servers.reduce((s1,s2)=>s1.ram<=s2.ram?s1:s2);
    };

    while (true) {
        await ns.sleep(50);

        const {
            requiredJobRam,
            purchasedServerLimit,
            purchasedServerCosts,
            purchasedServerMaxRam,
        } = getStaticData(ns);

        const {
            income,
            theftRatePerGB,
        } = getMoneyData(ns);

        const servers = getPurchasedServerRams(ns, purchasedServerLimit);
        if (servers.length === purchasedServerLimit &&
            servers.every(server=>server.ram === purchasedServerMaxRam)) {
            disableService(ns, 'server-purchaser');
            return;
        }

        const timeToGoal = estimateTimeToGoal(ns);
        const money = ns.getServerMoneyAvailable('home');

        const atMaxServers = servers.length === purchasedServerLimit;
        const smallest = getSmallestServer(servers);

        let minRam = 4;
        if (atMaxServers)
            minRam = smallest.ram * 2;

        if (money < purchasedServerCosts[minRam])
            continue;

        if (needsJobRam(ns) && getJobRamCost(ns) < money) {
            if (servers.length === 0) {
                await buyServer(requiredJobRam, requiredJobRam);
            } else {
                const hostname = `${THREADPOOL}-01`;
                ns.print(`Attempting to upgrade job server ${hostname} [${requiredJobRam}-${requiredJobRam}]GB`);
                await buyServer(requiredJobRam, requiredJobRam, hostname);
            }
            continue;
        }

        const profit = (ram) => {
            const newRam = ram - (smallest?.ram || 0);
            const ramProfit = timeToGoal * theftRatePerGB * newRam;
            return ramProfit - purchasedServerCosts[ram];
        };

        let maxRam = purchasedServerMaxRam;
        while (profit(maxRam) < 0 && maxRam >= minRam)
            maxRam /= 2;

        if (maxRam < minRam) {
            // ns.print(`Not purchasing server as it would only make $${Math.round(ramProfit/minRam)}/GB`);
            ns.print('Not purchasing server because estimated time of goal too soon');
            await ns.sleep(10000);
            continue;
        }

        if (servers.length === 0) {
            ns.print(`Attempting to purchase first server [${minRam}-${maxRam}]GB`);
            await buyServer(minRam, maxRam);
            continue;
        }

        if (!atCapacity(ns))
            continue;

        // Don't buy a server we'll replace right away
        while (minRam < purchasedServerMaxRam && purchasedServerCosts[minRam] < income * 5)
            minRam *= 2;

        if (minRam > maxRam || money < purchasedServerCosts[minRam])
            continue;

        if (atMaxServers)
            await buyServer(minRam, maxRam, smallest.hostname);
        else
            await buyServer(minRam, maxRam);
    }
}
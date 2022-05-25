import { THREADPOOL } from './etc/config';
import { infect, fullInfect } from './bin/infect';
import { logger } from './lib/logger';

const getNextServerName = (ns) => {
    for (let id = 1; ; id++) {
        const num = `${id}`.padStart(2, '0');
        const hostname = `${THREADPOOL}-${num}`;
        if (!ns.serverExists(hostname))
            return hostname;
    }
};

/** @param {NS} ns **/
const purchaseServer = (ns, hostname, minRam, maxRam) => {
    let ram = maxRam;
    while (!ns.purchaseServer(hostname, ram)) {
        ram /= 2;
        if (ram < minRam)
            return false;
    }
    return ram;
};

/** @param {NS} ns **/
const deleteServer = (ns, hostname) => {
    ns.killall(hostname);
    ns.deleteServer(hostname);
};

const JOB_SERVERS = [`${THREADPOOL}-01`, `${THREADPOOL}-02`];

/** @param {NS} ns **/
export async function main(ns) {
    const [minRam, maxRam, serverToReplace] = ns.args;
    if (isNaN(minRam) || isNaN(maxRam))
        throw new Error(`Illegal RAM range: ${minRam}-${maxRam}`);

    const money = ns.getServerMoneyAvailable('home');
    const minCost = ns.getPurchasedServerCost(minRam);
    const isUpgrade = serverToReplace != null;
    const hostname = serverToReplace || getNextServerName(ns);
    const isJobServer = JOB_SERVERS.includes(hostname);

    if (money < minCost) {
        await logger(ns).log(`Could not afford ${ns.nFormat(minCost, '0.000a')} for ${minRam}GB ram`);
        return;
    }

    if (isUpgrade)
        deleteServer(ns, hostname);
    
    const ram = purchaseServer(ns, hostname, minRam, maxRam);

    if (!ram) {
        // Rare. Seems to happen if a duplicate purchase is made,
        // messing up the server names.
        await logger(ns).error(`Failed to purchase ${minRam}GB ram on ${hostname}`);
        return;
    }

    const cost = ns.nFormat(ns.getPurchasedServerCost(ram), '0.000a');

    if (isUpgrade)
        await logger(ns).log(`Upgraded ${hostname} to ${ram}GB ram for ${cost}`);
    else
        await logger(ns).log(`Purchased ${hostname} with ${ram}GB ram for ${cost}`);

    if (isJobServer)
        await fullInfect(ns, hostname);
    else
        await infect(ns, hostname);
}
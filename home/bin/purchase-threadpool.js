import { THREADPOOL } from './etc/config';
import { infect, fullInfect } from './bin/infect';
import { logger } from './lib/logger';

const serverExists = (ns, hostname) => {
    try {
        ns.fileExists('DNE.js', hostname);
        return true;
    } catch {
        return false;
    }
};

const getNextServerName = (ns) => {
    const limit = ns.getPurchasedServerLimit();
    for (let n = 1; n <= limit; n++) {
        const num = n.toString().padStart(2, '0');
        const serverName = `${THREADPOOL}-${num}`;
        if (!serverExists(ns, serverName))
            return serverName;
    }
};

const mFormat = (ns, cost) => ns.nFormat(cost, '0.000a');

/** @param {NS} ns **/
const purchaseServer = (ns, hostname, minRam, isUpgrade) => {
    let ram = minRam * 8;
    while (!ns.purchaseServer(hostname, ram))
        ram /= 2;

    const cost = ns.getPurchasedServerCost(ram);

    if (isUpgrade)
        logger(ns).log(`Upgraded ${hostname} to ${ram}GB ram for ${mFormat(ns, cost)}`);
    else
        logger(ns).log(`Purchased ${hostname} with ${ram}GB ram for ${mFormat(ns, cost)}`);
};

/** @param {NS} ns **/
export async function main(ns) {
    const [minRam, serverToReplace] = ns.args;
    if (isNaN(minRam))
        throw new Error(`Illegal RAM value: ${minRam}`);

    const money = ns.getServerMoneyAvailable('home');
    const minCost = ns.getPurchasedServerCost(minRam);

    if (money < minCost) {
        logger(ns).log(`Could not afford ${mFormat(ns, minCost)} for ${minRam}GB ram`);
        return;
    }

    const isUpgrade = serverToReplace != null;
    const hostname = serverToReplace || getNextServerName(ns);
    const isJobServer = [`${THREADPOOL}-01`, `${THREADPOOL}-02`].includes(hostname);

    if (isUpgrade) {
        ns.killall(hostname);
        ns.deleteServer(hostname);
    }

    purchaseServer(ns, hostname, minRam, isUpgrade);

    if (isJobServer)
        await fullInfect(ns, hostname);
    else
        await infect(ns, hostname);
}
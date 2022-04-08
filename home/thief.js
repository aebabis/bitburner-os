import { logger } from './lib/logger';
import Thief from './lib/thief';

import { THREADPOOL_NAME } from './etc/config';
import { HOSTSFILE } from './etc/filenames';
import { PORT_SCH_RAM_DATA } from './etc/ports';
import Ports from './lib/ports';
import { by, waitToRead } from './lib/util';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    ns.tail();
    
    const hostnames = (await waitToRead(ns)(HOSTSFILE)).split(',');
    const possibleTargets = hostnames.filter(hostname => hostname !== 'home' &&
        !hostname.startsWith(THREADPOOL_NAME));

    const thieves = possibleTargets.map(hostname => new Thief(ns, hostname));

    const prioritze = () => thieves
        .filter(thief => thief.canHack())
        .sort(by(thief => -thief.getPredictedIncomeRatePerThread()))
        // .sort(by(thief => {
        //     const hostname = thief.getHostname();
        //     return ns.getServerMinSecurityLevel(hostname);
        //     // const maxedOut = ns.getServerMoneyAvailable(hostname)
        //     //     / ns.getServerMaxMoney(hostname) >= .99;
        //     // return maxedOut ? -1 : 1;
        // }));

    let viableThieves;
    let lastPriorization = 0;

    while(true) {
        try {
            const port = Ports(ns).getPortHandle(PORT_SCH_RAM_DATA);
            const ramData = port.peek();
            if (ramData == null)
                continue;

            if (Date.now() - lastPriorization > 10000) {
                viableThieves = prioritze();
                lastPriorization = Date.now();
            }
            for (const thief of viableThieves)
                await thief.advance();

            // viableThieves.forEach((thief) => {
            //     ns.print(thief.getHostname());
            // });

            const reservedThreads = viableThieves
                .map(thief => thief.getReservedThreads())
                .reduce((a,b)=>a+b, 0);
            
            const ramAvailable = ramData.totalRamUnused - reservedThreads * 1.75;
            const maxServerRamAvailable = ramData.rootServers
                .map(server => server.ramAvailable)
                .reduce((a,b)=>a>b?a:b,0);
            const processThreadLimit = Math.floor(maxServerRamAvailable / 1.75 / 10);
            
            ns.clearLog();
            ns.print('Hi');
            viableThieves.forEach(thief => thief.printFrames());
            if (ramAvailable > 0) {
                const thief = viableThieves
                    .find(thief => thief.canStartNextBatch());
                if (thief != null)
                    await thief.startNextBatch(ramAvailable * .9, processThreadLimit);
            }
            // ns.print('----------------------------');
            // ns.print(reservedThreads, ramAvailable);

            // frames.slice().reverse().forEach(frame=>ns.print(frame.tableString()));
        } catch (error) {
            await logger(ns).error(error);
        } finally {
            await ns.sleep(5);
        }
    }
}
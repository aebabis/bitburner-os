import { logger } from './logger';
import Thief from './lib/thief';

import { THREADPOOL_NAME } from './etc/config';
import { HOSTSFILE } from './etc/filenames';
import { PORT_SCH_RAM_DATA } from './etc/ports';
import Ports from './lib/ports';
import { by, waitToRead } from './lib/util';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    
    const hostnames = (await waitToRead(ns)(HOSTSFILE)).split(',');
    const possibleTargets = hostnames.filter(hostname => hostname !== 'home' &&
        !hostname.startsWith(THREADPOOL_NAME));

    const thieves = possibleTargets.map(hostname => new Thief(ns, hostname));

    const prioritze = () => thieves
        .filter(thief => thief.canHack())
        .sort(by(thief => -thief.getPredictedIncomeRatePerThread()));

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

            
            if (ramAvailable > 0) {
                const thief = viableThieves[0];
                if (thief.canStartNextFrame())
                    await thief.startNextFrame();
            }
            ns.clearLog();
            viableThieves[0].printFrames();
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
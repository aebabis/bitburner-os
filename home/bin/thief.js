import { logger } from './lib/logger';
import Thief from './lib/thief';

import { THREADPOOL_NAME } from './etc/config';
import { PORT_SCH_RAM_DATA } from './etc/ports';
import Ports from './lib/ports';
import { by } from './lib/util';
import { table } from './lib/table';
import { getHostnames } from './lib/data-store';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    ns.tail();

    const feed = [];
    const log = (message) => {
        feed.push(message);
        while (feed.length > 10)
            feed.shift();
    }
    
    const hostnames = getHostnames(ns);
    const possibleTargets = hostnames.filter(hostname => hostname !== 'home' &&
        !hostname.startsWith(THREADPOOL_NAME) && ns.getServerMaxMoney(hostname) > 0);

    const thieves = possibleTargets.map(hostname => new Thief(ns, hostname));

    const prioritze = () => thieves
        .filter(thief => thief.canHack())
        .sort(by(thief => -thief.getDesirability()))

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

            const reservedThreads = viableThieves
                .map(thief => thief.getReservedThreads())
                .reduce((a,b)=>a+b, 0);
            
            let ramAvailable = ramData.totalRamUnused - reservedThreads * 1.75;
            
            ns.clearLog();
            const rows = viableThieves
                .filter(thief=>thief.currentBatch != null && !thief.currentBatch.hasEnded())
                .map(thief => thief.getTableData())
                .map(({ hostname, type, frame, portion, jobs, ended, timeLeft }) => {
                    const money = ns.getServerMoneyAvailable(hostname);
                    const maxMoney = ns.getServerMaxMoney(hostname);
                    const curSecurity = ns.getServerSecurityLevel(hostname);
                    const minSecurity = ns.getServerMinSecurityLevel(hostname);
                    const moneyStr = `${ns.nFormat(money, '0.00a')}/${ns.nFormat(maxMoney, '0.00a')}`;
                    const secStr = `${+curSecurity.toFixed(1)}/${minSecurity}`;
                    return [hostname, moneyStr, secStr, type, frame, portion, jobs, timeLeft];
                })
                .sort(by(0));
            const tString = table(ns, ['SERVER', 'MONEY', 'SEC', 'FRAME', 'STRUCT', 'PORTION', 'JOBS', 'TIME'], rows);
            ns.print(tString);
            ns.print(' RAM AVAILABLE: ' + ns.nFormat(ramAvailable, '0.00'));
            ns.print('-'.repeat(tString.indexOf('\n')+1));
            feed.forEach(message => ns.print(message));
            const stealing = viableThieves.filter(thief => thief.isStealing());
            const grooming = viableThieves.filter(thief => thief.isGrooming());
            ns.print(stealing.length + '/' + grooming.length);
            const mayGroom = grooming.length <= stealing.length;
            const thief = viableThieves
                .find(thief => thief.canStartNextBatch() && (thief.isGroomed() || mayGroom));
            if (thief != null) {
                    // break;
            ns.print(thief.getHostname());
                const threads = await thief.startNextBatch(ramAvailable * .9, ramData.maxRamSlot / 2);
                if (threads > 0)
                    // break;
                log(`Started batch on ${thief.getHostname()}`);
                ramAvailable -= threads * 1.75;
            }
        } catch (error) {
            console.log(error);
            await logger(ns).error(error);
        } finally {
            await ns.sleep(5);
        }
    }
}
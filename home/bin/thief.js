import { THREADPOOL } from './etc/config';
import { logger } from './lib/logger';
import { by } from './lib/util';
import { table } from './lib/table';
import { getHostnames, getRamData } from './lib/data-store';

import Thief from './lib/thief';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    ns.tail();

    const feed = [];
    const log = (message) => {
        feed.push(message);
        while (feed.length > 10)
            feed.shift();
    };
    
    const hostnames = getHostnames(ns);
    const possibleTargets = hostnames.filter(hostname => hostname !== 'home' &&
        !hostname.startsWith(THREADPOOL) && ns.getServerMaxMoney(hostname) > 0);

    const thieves = possibleTargets.map(hostname => new Thief(ns, hostname));

    const prioritze = () => thieves
        .filter(thief => thief.canHack())
        .sort(by(thief => -thief.getDesirability()));

    let viableThieves;
    let lastPriorization = 0;

    while(true) {
        try {
            const ramData = getRamData(ns);
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
                .map(({ hostname, type, frame, portion, jobs, timeLeft }) => {
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
            ns.print(' ' + '-'.repeat(tString.indexOf('\n')+1));
            feed.forEach(message => ns.print(' ' + message));
            const stealing = viableThieves.filter(thief => thief.isStealing());
            const grooming = viableThieves.filter(thief => thief.isGrooming());
            const mayGroom = grooming.length <= stealing.length;
            const thief = viableThieves
                .find(thief => thief.canStartNextBatch() && (thief.isGroomed() || mayGroom));
            if (thief != null) {
                const threads = await thief.startNextBatch(ramAvailable * .9, ramData.maxRamSlot / 2);
                if (threads > 0)
                    log(`Started batch on ${thief.getHostname()}`);
                ramAvailable -= threads * 1.75;
            }
        } catch (error) {
            console.error(error);
            await logger(ns).error(error);
        } finally {
            await ns.sleep(5);
        }
    }
}
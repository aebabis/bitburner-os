import { THREADPOOL } from '../etc/config';
import { logger } from '../lib/logger';
import { by } from '../lib/util';
import { table } from '../lib/table';
import { getHostnames, getRamData } from '../lib/data-store';

import Thief from '../lib/thief';
import { initProfiler } from '../lib/profiler';

/** @param {NS} ns **/
export async function main(ns) {
    initProfiler();
    ns.disableLog('ALL');

    ns.ui.openTail();

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

    const prioritize = (ram) => thieves
        .filter(thief => thief.canHack())
        .sort(by(thief => -thief.getDesirability(ram)));

    let viableThieves;
    let lastPrioritization = 0;

    while(true) {
        try {
            const ramData = getRamData(ns);
            if (ramData == null)
                continue;

            if (Date.now() - lastPrioritization > 10000) {
                viableThieves = prioritize(ramData.totalMaxRam);
                lastPrioritization = Date.now();
            }

            const reservedThreads = viableThieves
                .map(thief => thief.getReservedThreads())
                .reduce((a,b)=>a+b, 0);

            let ramAvailable = ramData.totalRamUnused - reservedThreads * 1.75;

            // God mode: when one hack thread can steal 50%+ of the best server,
            // batches are trivially cheap and spreading across all servers is better.
            const [topThief] = viableThieves;
            const godMode = topThief != null && ns.hackAnalyze(topThief.getHostname()) >= 0.5;

            ns.clearLog();
            const secStr = (hostname) =>
                `${+ns.getServerSecurityLevel(hostname).toFixed(1)}/${ns.getServerMinSecurityLevel(hostname)}`;
            const moneyStr = (hostname) =>
                `${ns.formatNumber(ns.getServerMoneyAvailable(hostname), 2)}/${ns.formatNumber(ns.getServerMaxMoney(hostname), 2)}`;
            const rows = viableThieves
                .filter(thief => thief.currentBatch != null && !thief.currentBatch.hasEnded())
                .map(thief => thief.getTableData())
                .map(({ hostname, type, frame, portion, jobs, timeLeft }) => {
                    return [hostname, moneyStr(hostname), secStr(hostname), type, frame, portion, jobs, timeLeft];
                })
                .sort(by(0));
            const tString = table(ns, ['SERVER', 'MONEY', 'SEC', 'TYPE', 'FRAME', 'PORTION', 'JOBS', 'TIME'], rows);
            ns.print(tString);
            ns.print(` RAM AVAILABLE: ${ramAvailable.toFixed(2)}  MODE: ${godMode ? 'GOD' : 'FOCUS'}`);
            ns.print(' ' + '-'.repeat(tString.indexOf('\n')+1));
            feed.forEach(message => ns.print(' ' + message));

            const stealing = viableThieves.filter(thief => thief.isStealing());
            const grooming = viableThieves.filter(thief => thief.isGrooming());
            const mayGroom = grooming.length <= stealing.length;
            const mayStart = thief => thief.canStartNextBatch() && (thief.isGroomed() || mayGroom);

            const startable = viableThieves.filter(mayStart);
            const candidates = godMode ? startable : (mayStart(topThief) ? [topThief] : []);
            const ramBudget = godMode
                ? (ramAvailable / Math.max(candidates.length, 1)) * 0.9
                : ramAvailable * 0.9;

            for (const thief of candidates) {
                if (ramAvailable <= 0) break;
                const outcome = await thief.startNextBatch(ramBudget, ramData.maxRamSlot / 2);
                if (outcome) {
                    log(`Started batch on ${thief.getHostname()}`);
                    ramAvailable -= thief.getReservedThreads() * 1.75;
                }
            }
        } catch (error) {
            console.error(error);
            await logger(ns).error(error);
        } finally {
            await ns.sleep(5);
        }
    }
}

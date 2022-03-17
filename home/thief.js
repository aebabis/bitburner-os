import { WEAKEN, GROW, HACK } from './etc/filenames';
import { uuid } from './lib/util';
import { execAnyHost } from './lib/scheduler-api';
import { logger } from './logger';

const THEFT_PORTION = .25;
const SUBTASK_SPACING = 50;
const DEFAULT_THREAD_COUNT = 1024;

/** @param {NS} ns **/
const getWThreads = (ns, targetDecrease, cores=1) => {
    const weakSize = ns.getScriptRam(WEAKEN);
    const maxRam = ns.getPurchasedServerMaxRam();
    let min = 0;
    let max = Math.ceil(maxRam / weakSize);
    while (max > min) {
        const weakThreads = Math.floor((min + max) / 2);
        const secDecrease = ns.weakenAnalyze(weakThreads, cores);
        if (secDecrease < targetDecrease) {
            min = weakThreads + 1;
        } else {
            max = weakThreads - 1;
        }
    }
    return Math.ceil(min) || 1;
}

/** @param {NS} ns **/
const getHThreads = (ns, target, portion) => Math.floor(portion / ns.hackAnalyze(target));

/** @param {NS} ns **/
const getGWThreads = (ns, server, multiplier, maxThreads, cores=1) => {
    if (multiplier === Infinity) {
        return { grow: maxThreads, weak: 0 };
    }
    const threads = Math.min(maxThreads, ns.growthAnalyze(server, multiplier, cores))
    let min = 0;
    let max = threads;
    while (min < max) {
        const growThreads = Math.floor((min + max) / 2);
        const weakThreads = threads - growThreads;
        const secIncrease = ns.growthAnalyzeSecurity(growThreads);
        const secDecrease = ns.weakenAnalyze(weakThreads, cores);
        if (secIncrease < secDecrease) {
            min = growThreads + 1;
        } else {
            max = growThreads - 1;
        }
    }
    const grow = Math.floor(min);
    const weak = maxThreads - grow;
    return { grow, weak };
}

/** @param {NS} ns **/
const neededGrowth = (ns, hostname) => ns.getServerMaxMoney(hostname) / ns.getServerMoneyAvailable(hostname);

/** @param {NS} ns **/
const groom = async (ns, hostname) => {
    const console = logger(ns);
    ns.print('Attempting to groom ' + hostname);
    const security = ns.getServerSecurityLevel(hostname);
    const minSecurity = ns.getServerMinSecurityLevel(hostname);
    const money = ns.getServerMoneyAvailable(hostname);
    const maxMoney = ns.getServerMaxMoney(hostname);
    const cores = 1; // TODO
    const weakenTime = ns.getWeakenTime(hostname);

    const secDecrease = security - minSecurity;
    if (secDecrease > 0) {
        const weakThreads = getWThreads(ns, secDecrease, cores);
        if (weakThreads === Infinity) {
            ns.print(`ERROR - Computed hack for ineligible server ${hostname}`);
            await ns.sleep(10000);
            return;
        }
        let threadsRemaining = weakThreads;
        ns.print(`Starting W-attack server=${hostname} W=${weakThreads} (${weakenTime}ms)`);
        while (threadsRemaining > 0) {
            const { threads } = await execAnyHost(ns)(WEAKEN, threadsRemaining, hostname, uuid());
            threadsRemaining -= threads;
        }
        await ns.sleep(weakenTime);
    } else if (security > minSecurity || money < maxMoney) {
        const growTime = ns.getGrowTime(hostname);
        const weakenWait = Math.max(growTime + 50 - weakenTime, 0);
        const growAmount = neededGrowth(ns, hostname);
        const { grow, weak } = getGWThreads(ns, hostname, growAmount, DEFAULT_THREAD_COUNT, cores);
        ns.print(`Starting GW-attack server=${hostname} G=${grow} W=${weak}`);
        try {
            if (weak > 0)
                await execAnyHost(ns)(WEAKEN, weak, hostname, uuid());
            if (grow > 0) {
                await execAnyHost(ns)(GROW, grow, hostname, uuid());
            }
            await ns.sleep(weakenWait);
        } catch (error) {
            await console.error(error);
        }
        await ns.sleep(200);
    }
}

/** @param {NS} ns **/
const getHackSchedule = async (ns, target) => {
    const weakTime = ns.getWeakenTime(target);

    const hackThreads = Math.min(1024, getHThreads(ns, target, THEFT_PORTION));
    const secIncrease1 = ns.hackAnalyzeSecurity(hackThreads);
    
    const weakThreads1 = getWThreads(ns, secIncrease1);

    const growFactor  = 1 / (1 - THEFT_PORTION);
    const growThreads = Math.ceil(ns.growthAnalyze(target, growFactor));

    const secIncrease2 = ns.growthAnalyzeSecurity(growThreads);
    const weakThreads2 = getWThreads(ns, secIncrease2);

    // WINDOWS:
    // WWWWWWWWWWWWWWWWWWWWWWWWWWWW
    //   WWWWWWWWWWWWWWWWWWWWWWWWWWWW
    //        GGGGGGGGGGGGGGGGGGGGGG
    //                   HHHHHHHHH
    const weak1Start = 0;
    const weak2Start = weak1Start + SUBTASK_SPACING * 2;
    // const growStart  = weakTime + SUBTASK_SPACING - growTime;
    // const hackStart  = weakTime - SUBTASK_SPACING * 3 - growTime;

    return async () => {
        await execAnyHost(ns)(WEAKEN, weakThreads1, target);
        const start = Date.now();
        const ts = () => Date.now() - start;
        ns.print(`Attack started on ${target}. W=[${weak1Start}, ${weak2Start} ? ?]`);
        ns.print(`  (${ts()}) weaken T=${weakThreads1}`);
        await ns.sleep(weak2Start - ts());

        await execAnyHost(ns)(WEAKEN, weakThreads2, target);
        ns.print(`  (${ts()}) weaken T=${weakThreads2}`);
        const growTime = ns.getGrowTime(target);
        const growStart = weakTime + SUBTASK_SPACING - growTime;
        await ns.sleep(growStart - ts());

        await execAnyHost(ns)(GROW, growThreads, target);
        ns.print(`  (${ts()}) grow   T=${growThreads}`);
        const hackTime  = ns.getHackTime(target);
        const hackStart = weakTime - SUBTASK_SPACING - hackTime;
        const hackDelay = hackStart - ts();

        // TODO: Write a batcher to prevent excessive job delay
        // if (hackDelay > 0) {
            await ns.sleep(hackDelay);
            const actualHackThreads = getHThreads(ns, target, THEFT_PORTION);
            await execAnyHost(ns)(HACK, actualHackThreads, target);
            ns.print(`  (${ts()}) hack   T=${actualHackThreads}`);
        // } else {
        //     ns.print(`  (${ts()}) hack WINDOW CLOSED`);
        // }
    }
}

export const isServerGroomed = ({
    hasAdminRights, moneyAvailable, moneyMax,
    minDifficulty, hackDifficulty, purchasedByPlayer,
}) => (
    hasAdminRights && !purchasedByPlayer &&
    moneyAvailable / moneyMax > .99 &&
    minDifficulty / hackDifficulty > .99
);

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    const console = logger(ns);
    const target = ns.args[0];
    while(true) {
        try {
            while (isServerGroomed(ns.getServer(target))) {
                const hwgwFrame = await getHackSchedule(ns, target);
                await hwgwFrame();
                await ns.sleep(50);
            }
            await groom(ns, target);
        } catch (error) {
            await console.error(error);
        }
        await ns.sleep(50);
    }
}
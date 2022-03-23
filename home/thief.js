import { WEAKEN, GROW, HACK } from './etc/filenames';
import { delegateAny } from './lib/scheduler-delegate';
import { report } from './lib/thief-port';
import { logger } from './logger';

const THEFT_PORTION = .05;
const SUBTASK_SPACING = 50;

/** @param {NS} ns **/
const getWThreads = (ns, targetDecrease, cores=1) => {
    const weakSize = ns.getScriptRam(WEAKEN);
    const maxRam = ns.getPurchasedServerMaxRam();
    let min = 1;
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

/** @param {NS} ns
 * Gets a relative-time window for the start
 * and end of a single HWGW frame.
 **/
const getNextHackFrame = async (ns, target, portion, [avoidBegin, avoidEnd]) => {
    let newInterval = avoidBegin + ns.getHackTime(target) < avoidEnd;
    let endAfter = avoidEnd;
    if (newInterval) {
        endAfter = avoidEnd + ns.getHackTime(target);
    }
    if (Date.now() + ns.getWeakenTime(target) - SUBTASK_SPACING < endAfter)
        return null;

    const hackThreads = Math.floor(portion / ns.hackAnalyze(target));
    const secIncrease1 = ns.hackAnalyzeSecurity(hackThreads);

    const weaken1Threads = getWThreads(ns, secIncrease1);

    const growFactor  = 1 / (1 - THEFT_PORTION);
    const growThreads = Math.ceil(ns.growthAnalyze(target, growFactor));

    const secIncrease2 = ns.growthAnalyzeSecurity(growThreads);
    const weaken2Threads = getWThreads(ns, secIncrease2);

    const startSubtask = async (task, taskThreads) => {
        // ns.print('Attempting ' + task + ' with t=' + taskThreads);
        const { threads } = await delegateAny(ns, true)(task, taskThreads, target, crypto.randomUUID());
        // ns.print('  t_a=' + threads);
        if (threads < taskThreads) {
            return threads;
        } else {
            canProceed = null;
            return threads;
        }
    }

    const status = {
        weaken1Threads: weaken1Threads.toString(),
        weaken2Threads: '?',
        growThreads: '?',
        hackThreads: '?',
    };

    let startTime;
    let weaken1End;

    let canProceed;
    let next;

    const dispatchWeaken1 = async () => {
        if (await startSubtask(WEAKEN, weaken1Threads) === weaken1Threads) {
            startTime = Date.now();
            weaken1End = startTime + ns.getWeakenTime(target);
            canProceed = () => Date.now() + ns.getWeakenTime(target) >= weaken1End + SUBTASK_SPACING * 2;
            next = dispatchWeaken2;
            const intervalStart = newInterval ? weaken1End - SUBTASK_SPACING : avoidBegin;
            const intervalEnd = weaken1End + SUBTASK_SPACING * 4;
            return [intervalStart, intervalEnd];
        }
        return null;
    }

    const dispatchWeaken2 = async () => {
        if (await startSubtask(WEAKEN, weaken2Threads) === weaken2Threads) {
            status.weaken2Threads = weaken2Threads.toString();
            canProceed = () => Date.now() + ns.getGrowTime(target) >= weaken1End - SUBTASK_SPACING;
            next = dispatchGrow;
        }
    }

    const dispatchGrow = async () => {
        const neededGrowth = ns.getServerMaxMoney(target) / ns.getServerMoneyAvailable(target);
        const actualGrowthFactor = neededGrowth * growFactor;
        const actualGrowThreads = Math.ceil(ns.growthAnalyze(target, actualGrowthFactor));
        if (await startSubtask(GROW, actualGrowThreads) === actualGrowThreads) {
            status.growThreads = actualGrowThreads.toString();
            canProceed = () => Date.now() < avoidBegin && Date.now() + ns.getHackTime(target) >= endAfter;
            next = dispatchHack;
        }
    }

    const dispatchHack = async () => {
        const preferredHackThreads = Math.ceil(portion / ns.hackAnalyze(target));
        const actualHackThreads = await startSubtask(HACK, preferredHackThreads);
        status.hackThreads = actualHackThreads.toString();
        canProceed = null;
    }

    const done = () => canProceed == null || Date.now() > endAfter;
    const ended = () => Date.now() > endAfter;

    const tableString = () => {
        const ago = startTime - Date.now();
        const weaken1T = status.weaken1Threads.padStart(4);
        const weaken2T = status.weaken2Threads.padStart(4);
        const growT = status.growThreads.padStart(4);
        const hackT = status.hackThreads.padStart(4);
        return `${startTime}(${ago})  ${weaken1T} ${weaken2T} ${growT} ${hackT}`;
    };

    const interval = await dispatchWeaken1();
    if (interval == null)
        return null;

    return {
        next: () => next(),
        canProceed: () => canProceed(),
        done,
        ended,
        getProtectedInterval: () => interval,
        tableString,
    };
}

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    const target = ns.args[0];
    report(ns, target, null);
    let frames = [];
    let interval = [0, 0];
    while(true) {
        try {
            ns.print(1);
            frames = frames.filter(frame=>!frame.ended());
            ns.print(frames.length);
            for (const frame of frames)
                if (!frame.done() && frame.canProceed())
                    await frame.next();
            ns.print('?');
            const nextFrame = await getNextHackFrame(ns, target, THEFT_PORTION, interval);
            ns.print(nextFrame);
            if (nextFrame) {
                frames.push(nextFrame);
                interval = nextFrame.getProtectedInterval();
            }
            ns.clearLog();
            frames.slice().reverse().forEach(frame=>ns.print(frame.tableString()));
        } catch (error) {
            await logger(ns).error(error);
        } finally {
            await ns.sleep(SUBTASK_SPACING / 5);
        }
    }
}
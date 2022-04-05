import { WEAKEN, GROW, HACK } from './etc/filenames';
import { delegateAny } from './lib/scheduler-delegate';
import { report } from './lib/thief-port';
import { logger } from './logger';

const SUBTASK_SPACING = 50;
const SMALL = '₀₁₂₃₄₅₆₇₈₉'.split('');

const small = number => number.toString()
    .split('').map(n=>SMALL[n]).join('');

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

const startSubtask = async (ns, target, task, taskThreads) => {
    // ns.print('Attempting ' + task + ' with t=' + taskThreads);
    const { threads } = await delegateAny(ns, true)(task, taskThreads, target, crypto.randomUUID());
    return threads;
}

class HWGWFrame {
    constructor(ns, target, portion, [avoidBegin, avoidEnd]) {
        const duration = ns.getWeakenTime(target) + SUBTASK_SPACING * 2;
        const income = ns.getServerMaxMoney(target) * portion;

        const hackThreads = Math.floor(portion / ns.hackAnalyze(target));
        const secIncrease1 = ns.hackAnalyzeSecurity(hackThreads);
        const weaken1Threads = getWThreads(ns, secIncrease1);
    
        const growFactor  = 1 / (1 - portion);
        const growThreads = Math.ceil(ns.growthAnalyze(target, growFactor));
        const secIncrease2 = ns.growthAnalyzeSecurity(growThreads);
        const weaken2Threads = getWThreads(ns, secIncrease2);

        this.ns = ns;
        this.target = target;
        this.portion = portion;

        // If the hack threads would be dispatched during the 
        // disallowed window, instead shift the start of the entire
        // frame to start a new frame group.
        this.startsGroup = avoidEnd - avoidBegin < ns.getHackTime(target);
        this.protectedIntervalStart = this.startsGroup ? null : avoidBegin;
        this.previousProtectedInterval = [avoidBegin, avoidEnd];

        // Earliest weaken1 end time
        this.endAfter = !this.startsGroup ? avoidEnd : avoidEnd + ns.getHackTime(target);

        this.state = 'START';
        this.predicted = {
            weaken1Threads,
            weaken2Threads,
            growThreads,
            hackThreads,
            duration,
            income,
        };
        this.actual = {};
    }

    static computeMaxTheftPortion(ns, target, processThreadLimit) {
        // TODO: bin search for optimal params
        let min = 0;
        let max = 1;
        let attemptsRemaining = 20;
        while (attemptsRemaining --> 0) {
            const portion = (min + max) / 2;
            const frame = new HWGWFrame(ns, target, portion, [0, 0]);
            const threads = Math.max(frame.predicted.growThreads,
                frame.predicted.hackThreads);
            if (threads < processThreadLimit)
                min = portion;
            else if (threads > processThreadLimit)
                max = portion;
            else
                return portion;
        }
        return min;
    }

    static getOptimalFrame(ns, target, processThreadLimit, interval) {
        const maxPortion = this.computeMaxTheftPortion(
            ns, target, processThreadLimit);
        // ns.print('MAX PORTION: ', maxPortion);
        // TODO: bin search for optimal params
        let min = new HWGWFrame(ns, target, .00001, interval);
        let mid = new HWGWFrame(ns, target, maxPortion/2, interval);
        let max = new HWGWFrame(ns, target, maxPortion, interval);
        let attemptsRemaining = 20;
        while (attemptsRemaining --> 0) {
            const portion1 = (min.portion + mid.portion) / 2;
            const portion2 = (mid.portion + max.portion) / 2;
            const quart1 = new HWGWFrame(ns, target, portion1, interval);
            const quart3 = new HWGWFrame(ns, target, portion2, interval);
            if (quart1.getPredictedIncomeRatePerThread() >
                mid.getPredictedIncomeRatePerThread()) {
                    max = mid;
                    mid = quart1;
                }
            else {
                min = mid;
                mid = quart3;
            }
        }
        // ns.print('SELECTED PORTION: ', mid.portion);
        return mid;
    }

    getPredictedThreads() {
        const { weaken1Threads, weaken2Threads, growThreads, hackThreads } = this.predicted;
        return weaken1Threads + weaken2Threads + growThreads + hackThreads;
    }

    getReservedThreads() {
        const { weaken1Threads, weaken2Threads, growThreads, hackThreads } = this.predicted;
        const { state } = this;
        switch (state) {
            case 'START':
                return weaken1Threads + weaken2Threads + growThreads + hackThreads;
            case 'WEAKEN1':
                return weaken2Threads + growThreads + hackThreads;
            case 'WEAKEN2':
                return growThreads + hackThreads;
            case 'GROW':
                return hackThreads;
            case 'HACK':
            case 'DEAD':
            case 'DONE':
                return 0;
        }
    }

    // TODO: Take into account different utilization times per operation
    getPredictedIncomeRatePerThread() {
        return this.predicted.income * this.ns.hackAnalyzeChance(this.target) / (this.getPredictedThreads() * this.predicted.duration);
    }

    hasDispatchedWeaken2() {
        return this.state !== 'START' && this.state !== 'WEAKEN1';
    }

    getNextFrameProtectedInterval() {
        if (this.state === 'START' || this.state === 'WEAKEN1') {
            throw new Error('Cannot determine protected interval until weaken 2 has started');
        }
        if (this.state === 'DEAD') // Guaranteed no hack threads
            return this.previousProtectedInterval;
        return [this.protectedIntervalStart, this.protectedIntervalEnd];
    }

    canProceed() {
        const { ns, target, state } = this;
        switch (state) {
            case 'START':
                return Date.now() + ns.getWeakenTime(target) > this.endAfter + SUBTASK_SPACING;
            case 'WEAKEN1':
                return Date.now() + ns.getWeakenTime(target) >= this.weaken1End + SUBTASK_SPACING * 2;
            case 'WEAKEN2':
                return Date.now() + ns.getGrowTime(target) >= this.weaken1End + SUBTASK_SPACING;
            case 'GROW':
                return Date.now() < this.protectedIntervalStart &&
                       Date.now() + ns.getHackTime(target) >= this.weaken1End + SUBTASK_SPACING * 3;
            case 'HACK':
            case 'DEAD':
            case 'DONE':
                return false;
        }
    }

    async next() {
        const { ns, target, state } = this;
        switch (state) {
            case 'START':
                this.actual.weaken1Threads = await startSubtask(ns, this.target, WEAKEN, this.predicted.weaken1Threads);
                if (this.actual.weaken1Threads !== this.predicted.weaken1Threads) {
                    this.state = 'DEAD';
                } else {
                    this.startTime = Date.now();
                    this.weaken1End = this.startTime + ns.getWeakenTime(target);
                    if (this.startsGroup)
                        this.protectedIntervalStart = this.weaken1End - SUBTASK_SPACING; 
                    this.state = 'WEAKEN1';
                }
                break;
            case 'WEAKEN1':
                this.actual.weaken2Threads = await startSubtask(ns, this.target, WEAKEN, this.predicted.weaken2Threads);
                if (this.actual.weaken2Threads !== this.predicted.weaken2Threads) {
                    this.state = 'DEAD';
                } else {
                    this.protectedIntervalEnd = Date.now() + ns.getWeakenTime(target) + SUBTASK_SPACING;
                    this.state = 'WEAKEN2';
                }
                break;
            case 'WEAKEN2':
                this.actual.growThreads = await startSubtask(ns, this.target, GROW, this.predicted.growThreads);
                if (this.actual.growThreads === 0) {
                    this.state = 'DEAD'
                } else {
                    this.state = 'GROW';
                }
                break;
            case 'GROW':
                // const maxMoney = ns.getServerMaxMoney(this.target);
                // const moneyAvailable = ns.getServerMoneyAvailable(this.target);
                // if (moneyAvailable / maxMoney < (1 - this.portion)) {
                //     this.state = 'DEAD';
                //     return;
                // }

                // Adjust hack threads requested
                // based on current level and actual
                // grow threads obtained.
                let requestedHackThreads = this.predicted.hackThreads;
                while (requestedHackThreads > 0) {
                    const actualPortion = requestedHackThreads * ns.hackAnalyze(target);
                    const growFactor = 1 / (1 - actualPortion);
                    const requiredGrowThreads = Math.ceil(
                        ns.growthAnalyze(target, growFactor));
                    if (requiredGrowThreads <= this.actual.growThreads)
                        break;
                    else
                        requestedHackThreads--;
                }
                
                // One less so that grow wins?
                requestedHackThreads--;

                if (requestedHackThreads <= 0) {
                    this.state = 'DEAD';
                    break;
                }

                this.actual.hackThreads = await startSubtask(
                    ns, this.target, HACK, requestedHackThreads);
                if (this.actual.hackThreads === 0) {
                    this.state = 'DEAD';
                } else {
                    this.state = 'HACK';
                }
                break;
            case 'HACK':
            case 'DEAD':
            case 'DONE':
                throw new Error ('Nothing to do in state ' + this.state);
        }
    }

    hasEnded() {
        return Date.now() > this.protectedIntervalEnd;
    }

    toString() {
        const num = (a, b) => a != null ? a : b;
        const state = this.state.padEnd(7);
        const ago = this.startTime - Date.now();
        const weaken1T = num(this.actual.weaken1Threads, small(this.predicted.weaken1Threads));
        const weaken2T = num(this.actual.weaken2Threads, small(this.predicted.weaken2Threads));
        const growT = num(this.actual.growThreads, small(this.predicted.growThreads));
        const hackT = num(this.actual.hackThreads, small(this.predicted.hackThreads));
        return `${this.target.padEnd(18)} ${state}(${ago.toString().padStart(6)})  ${weaken1T} ${weaken2T} ${growT} ${hackT}`;
    }
}

export default class Thief {
    constructor(ns, server) {
        this.ns = ns;
        this.server = server;
        this.frames = [];
        this.protectedInterval = [0, 0];
    }

    getHostname() {
        return this.server;
    }

    canHack() {
        return this.ns.hasRootAccess(this.server);
    }

    getCurrentFrame() {
        return this.frames[this.frames.length - 1] || null;
    }

    canStartNextFrame() {
        const currentFrame = this.getCurrentFrame();
        return currentFrame == null || currentFrame.hasDispatchedWeaken2();
    }

    async startNextFrame(growThreadLimit) {
        const { ns, server, protectedInterval } = this;
        const nextFrame = HWGWFrame.getOptimalFrame(
            ns, server, growThreadLimit, protectedInterval);
        if (nextFrame.predicted.hackThreads === 0)
            return;
        this.frames.push(nextFrame);
        if (nextFrame.canProceed())
            await nextFrame.next();
    }

    async advance() {
        this.frames = this.frames.filter(frame => !frame.hasEnded());
        for (const frame of this.frames) {
            if (frame.canProceed())
                await frame.next();
        }
    }

    getPredictedIncomeRatePerThread(portionOrMaxGrowThreads = .01) {
        return new HWGWFrame(this.ns, this.server, portionOrMaxGrowThreads, [0, 0]).getPredictedIncomeRatePerThread();
    }

    getReservedThreads() {
        return this.frames
            .map(frame => frame.getReservedThreads())
            .reduce((a,b)=>a+b, 0);
    }

    // TODO?
    atCapacity() {
        return false;
    }

    printFrames() {
        this.frames.slice().reverse()
            .forEach(frame => this.ns.print(frame.toString()));
    }

    // getPredictedConsumptionAt(time) {

    // }
}

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    const thief = new Thief(ns, ns.args[0]);
    ns.tprint(ns.getHackTime(ns.args[0]));
    ns.tprint(thief.getPredictedIncomeRatePerThread(ns.args[1] || .01) + '$/thread-second');
}
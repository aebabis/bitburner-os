import { WEAKEN, GROW, HACK } from './etc/filenames';
import { delegateAny } from './lib/scheduler-delegate';
import { report } from './lib/thief-port';
import { logger } from './lib/logger';

const SUBTASK_SPACING = 50;

const small = number => number.toString()
    .split('').map(n=>'₀₁₂₃₄₅₆₇₈₉'[n]).join('');

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
    const { threads } = await delegateAny(ns, true)(task, taskThreads, target, crypto.randomUUID());
    return threads;
}

const STATE_START = 'START';
const STATE_WEAKEN1 = 'WEAKEN1';
const STATE_WEAKEN2 = 'WEAKEN2';
const STATE_GROW = 'GROW';
const STATE_HACK = 'HACK';
const STATE_DEAD = 'DEAD';

class HWGWFrame {
    constructor(ns, target,
        [weaken1Start, weaken2Start, growStart, hackStart],
        [weaken1Threads, weaken2Threads, growThreads, hackThreads]) {
        this.ns = ns;
        this.target = target;
        this.state = STATE_START;
        this.weaken1Start = weaken1Start;
        this.weaken2Start = weaken2Start;
        this.growStart = growStart;
        this.hackStart = hackStart;
        this.weaken1Threads = weaken1Threads;
        this.weaken2Threads = weaken2Threads;
        this.growThreads = growThreads;
        this.hackThreads = hackThreads;
        this.actual = {};
    }

    async tick() {
        const { ns, target, state } = this;
        const now = Date.now();
        if (state === STATE_START && now >= this.weaken1Start) {
            const threads = await startSubtask(ns, target, WEAKEN, this.weaken1Threads);
            this.actual.weaken1Threads = threads;
            this.state = (threads === this.weaken1Threads) ? STATE_WEAKEN1 : STATE_DEAD;
        } else if (state === STATE_WEAKEN1 && now >= this.weaken2Start) {
            const threads = await startSubtask(ns, target, WEAKEN, this.weaken2Threads);
            this.actual.weaken2Threads = threads;
            this.state = (threads === this.weaken2Threads) ? STATE_WEAKEN2 : STATE_DEAD;
        } else if (state === STATE_WEAKEN2 && now >= this.growStart) {
            const threads = await startSubtask(ns, target, GROW, this.growThreads);
            this.actual.growThreads = threads;
            this.state = (threads === this.growThreads) ? STATE_GROW : STATE_DEAD;
        } else if (state === STATE_GROW && now >= this.hackStart) {
            let requestedHackThreads = this.hackThreads;
            while (requestedHackThreads > 0) {
                const actualPortion = requestedHackThreads * ns.hackAnalyze(target);
                const growFactor = 1 / (1 - actualPortion);
                const requiredGrowThreads = Math.ceil(
                    ns.growthAnalyze(target, growFactor));
                if (requiredGrowThreads <= this.growThreads)
                    break;
                requestedHackThreads--;
            }

            // One less so that grow wins?
            if (requestedHackThreads > 1) {
                requestedHackThreads--;
            }
            if (requestedHackThreads <= 0) {
                this.state = STATE_DEAD;
            } else {
                const threads = await startSubtask(ns, target, HACK, requestedHackThreads);
                this.actual.hackThreads = threads;
                this.state = (threads > 0) ? STATE_HACK : STATE_DEAD;
            }
        }
        return this.state === STATE_DEAD || this.state === STATE_HACK;
    }

    getReservedThreads() {
        switch (this.state) {
            case STATE_START: return this.weaken1Threads + this.weaken2Threads + this.growThreads + this.hackThreads;
            case STATE_WEAKEN1: return this.weaken2Threads + this.growThreads + this.hackThreads;
            case STATE_WEAKEN2: return this.growThreads + this.hackThreads;
            case STATE_GROW: return this.hackThreads;
            default: return 0;
        }
    }

    estimateReservedThreads() {
        let threads = 0;
        const timeRemaining = this.weaken2End - Date.now();
        switch (this.state) {
            case STATE_START: threads += this.weaken1Threads;
            case STATE_WEAKEN1: threads += this.weaken2Threads;
            case STATE_WEAKEN2: threads += this.growThreads * this.growTime / timeRemaining;
            case STATE_GROW: threads += this.hackThreads * this.hackTime / timeRemaining;
        }
        return threads;
    }

    toString() {
        const num = (a, b) => a != null ? a : b;
        const state = this.state.padEnd(8);
        const ago = this.weaken1Start - Date.now();
        const weaken1T = num(this.actual.weaken1Threads, small(this.weaken1Threads));
        const weaken2T = num(this.actual.weaken2Threads, small(this.weaken2Threads));
        const growT = num(this.actual.growThreads, small(this.growThreads));
        const hackT = num(this.actual.hackThreads, small(this.hackThreads));
        // const est = this.estimateReservedThreads();
        return `${this.target.padEnd(18)} ${state}(${ago.toString().padStart(6)})  ${weaken1T} ${weaken2T} ${growT} ${hackT}`;
    }
}

class HWGWBatch {
    constructor(ns, target, portion, ram, endAfter=Date.now()) {
        const weakenTime = ns.getWeakenTime(target);
        const growTime = ns.getGrowTime(target);
        const hackTime = ns.getHackTime(target);
        
        const income = ns.getServerMaxMoney(target) * portion;

        const hackThreads = Math.floor(portion / ns.hackAnalyze(target));
        const secIncrease1 = ns.hackAnalyzeSecurity(hackThreads);
        const weaken1Threads = getWThreads(ns, secIncrease1);
    
        const growFactor  = 1 / (1 - portion);
        const growThreads = Math.ceil(ns.growthAnalyze(target, growFactor));
        const secIncrease2 = ns.growthAnalyzeSecurity(growThreads);
        const weaken2Threads = getWThreads(ns, secIncrease2);

        const totalThreads = weaken1Threads + weaken2Threads + growThreads + hackThreads;
        const averageThreads = weaken1Threads + weaken2Threads + growThreads*3.2/4 + hackThreads/4;
	const ramPerFrame = totalThreads * 1.75;

        ns.tprint(ram);
        ns.tprint(totalThreads);
        ns.tprint(totalThreads * 1.75);

        let startBefore = endAfter;

        const frames = this.frames = [];

        this.ns = ns;
        this.target = target;
        this.portion = portion;
        this.income = income;

        if (hackThreads < 1)
            return;

        while (ram >= ramPerFrame) {
            const hackEnd = endAfter;
            const weaken1End = hackEnd + SUBTASK_SPACING;
            const growEnd = weaken1End + SUBTASK_SPACING;
            const weaken2End = growEnd + SUBTASK_SPACING;

            const weaken1Start = weaken1End - weakenTime;
            const weaken2Start = weaken2End - weakenTime;
            const growStart = growEnd - growTime;
            const hackStart = hackEnd - hackTime;

            if (hackStart >= startBefore)
                break;

            const frame = new HWGWFrame(ns, target,
		[weaken1Start, weaken2Start, growStart, hackStart],
                [weaken1Threads, weaken2Threads, growThreads, hackThreads]);
            
            frames.push(frame);
            ns.tprint(frame.getReservedThreads());

            ram -= ramPerFrame;
            endAfter = weaken2End + SUBTASK_SPACING;
        }
        ns.tprint(this.frames.length);

        this.peakThreads = this.frames.length * averageThreads;
        this.peakConsumption = this.peakThreads * 1.75;
        this.duration = endAfter - this.weaken1Start;
        this.endAfter = endAfter;
    }

    static computeMaxTheftPortion(ns, target, processThreadLimit) {
        // TODO: bin search for optimal params
        let min = 0;
        let max = 1;
        let attemptsRemaining = 20;
        while (attemptsRemaining --> 0) {
            const portion = (min + max) / 2;
            const growFactor  = 1 / (1 - portion);
            const threads = Math.ceil(ns.growthAnalyze(target, growFactor));
            if (threads < processThreadLimit)
                min = portion;
            else if (threads > processThreadLimit)
                max = portion;
            else
                return portion;
        }
        return min;
    }

    // TODO: Take into account different utilization times per operation
    getPredictedIncomeRatePerThread() {
        const predictedIncome = this.income * this.ns.hackAnalyzeChance(this.target);
        const duration = this.weaken2End - this.weaken1Start;
        return predictedIncome / (this.averageThreads * duration);
    }

    getReservedThreads() {
        return this.frames
            .map(frame => frame.getReservedThreads())
            .reduce((a,b)=>a+b,0);
    }

    estimateReservedThreads() {
        return this.frames
            .map(frame => frame.estimateReservedThreads())
            .reduce((a,b)=>a+b,0);
    }

    async tick() {
        for (const frame of this.frames) {
            await frame.tick();
        }
    }

    hasEnded() {
        const last = this.frames[this.frames.length - 1];
        if (last != null)
            return Date.now() > last.weaken2End;
        else return true;
    }

    toString() {
        return this.frames.map(frame=>frame.toString()).join('\n');
    }
}

export default class Thief {
    constructor(ns, server) {
        this.ns = ns;
        this.server = server;
    }

    getHostname = () => this.server;
    canHack = () => this.ns.hasRootAccess(this.server);
    canStartNextBatch = () => this.currentBatch == null ||
        this.currentBatch.hasEnded();

    async startNextBatch(ram, maxProcessThreads) {
        const { ns, server } = this;
        const portion = HWGWBatch.computeMaxTheftPortion(ns, server, maxProcessThreads);
        if (this.currentBatch == null)
            this.currentBatch = new HWGWBatch(ns, server, portion, ram);
        else
            this.currentBatch = new HWGWBatch(ns, server, portion, ram, this.currentBatch.endAfter);
	ns.tprint(this.currentBatch.getReservedThreads() * 1.75);
    }

    async advance() {
        const batch = this.currentBatch;
        if (batch != null && !batch.hasEnded())
            await batch.tick();
    }

    getPredictedIncomeRatePerThread(portionOrMaxGrowThreads = .01) {
        const { ns, server } = this;
        const portion = portionOrMaxGrowThreads < 1 ? portionOrMaxGrowThreads :
            HWGWBatch.computeMaxTheftPortion(ns, server, portionOrMaxGrowThreads);
        const income = ns.getServerMaxMoney(server) * portion;

        const weakenTime = ns.getWeakenTime(server);
        const hackThreads = Math.floor(portion / ns.hackAnalyze(server));
        const growFactor  = 1 / (1 - portion);
        const growThreads = Math.ceil(ns.growthAnalyze(server, growFactor));

        return income / (growThreads + hackThreads) / weakenTime;
    }

    getReservedThreads() {
        return this.currentBatch == null ? 0 :
            this.currentBatch.getReservedThreads();
    }

    estimateReservedThreads() {
        return this.currentBatch == null ? 0 :
            this.currentBatch.estimateReservedThreads();
    }

    printFrames() {
        if (this.currentBatch != null && !this.currentBatch.hasEnded())
            this.ns.print(this.currentBatch.toString());
    }
}

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    const thief = new Thief(ns, ns.args[0]);
    ns.tprint(ns.getHackTime(ns.args[0]));
    ns.tprint(thief.getPredictedIncomeRatePerThread(ns.args[1] || .01) + '$/thread-second');
}


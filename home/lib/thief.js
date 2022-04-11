import { WEAKEN, GROW, HACK } from './etc/filenames';
import { delegateAny } from './lib/scheduler-delegate';
// import { logger } from './lib/logger';
import { by } from './lib/util';

const SUBTASK_SPACING = 50;

/** @param {NS} ns **/
const getWThreads = (ns, targetDecrease, cores=1) => {
    let threads = 1;
    while (ns.weakenAnalyze(threads, cores) < targetDecrease)
        threads++;
    return threads;
}

class Job {
    constructor(ns, target, script, threads, startTime, prev) {
        this.ns = ns;
        this.target = target;
        this.script = script;
        this.threads = threads;
        this.startTime = startTime;
        this.prev = prev;
        if (prev)
            prev.next = this;
        this.dead = false;
    }

    async check() {
        if (this.prev?.dead)
            return true;
        if (Date.now() < this.startTime)
            return false;
        const { script, threads, target } = this;
        const uuid = crypto.randomUUID();
        const process = await delegateAny(this.ns, true)(script, threads, target, uuid);
        this.pid = process.pid;
        if (process.threads !== threads && this.next != null)
            this.die();
        return true;
    }

    die() {
        this.dead = true;
        this.ns.kill(this.pid);
        this.prev?.die();
    }

    // toString() {

// const small = number => number.toString()
// .split('').map(n=>'₀₁₂₃₄₅₆₇₈₉'[n]).join('');
    //     let str = '';
    //     let width = 50;
    //     let job = this;
    //     while (width > 0 && job != null) {
    //         const ahead = job.startTime - Date.now();
    //         if (ahead > 0) {
    //             const future = Math.min(width, Math.floor(ahead / SUBTASK_SPACING));
    //             str += ' '.repeat(future) + small(this.threads);
    //             width -= future;
    //         }
    //         job = job.next;
    //     }
    //     return str;
    // }
}

class HWGWBatch {
    constructor(ns, target, portion, ram, startAfter=Date.now()) {
        if (isNaN(portion))
            throw new Error('Portion must be a number. Got ' + portion);
        if (isNaN(ram))
            throw new Error('Ram must be a number. Got ' + portion);
        if (portion > .5) {
            ns.tprint('WARN - Hack portion cannot exceed .5');
            portion = .5;
        }

        this.ns = ns;
        this.target = target;
        this.portion = portion;

        const weakenTime = ns.getWeakenTime(target);
        const growTime = ns.getGrowTime(target);
        const hackTime = ns.getHackTime(target);

        let hackThreads = Math.floor(portion / ns.hackAnalyze(target));
        while (hackThreads < 1 && portion < .5) {
            portion += .01;
            hackThreads = Math.floor(portion / ns.hackAnalyze(target));
        }
        const secIncrease1 = ns.hackAnalyzeSecurity(hackThreads);
        if (secIncrease1 === Infinity)
            return;
        const weaken1Threads = getWThreads(ns, secIncrease1);

        const growFactor  = 1 / (1 - portion);
        const growThreads = Math.ceil(ns.growthAnalyze(target, growFactor));
        const secIncrease2 = ns.growthAnalyzeSecurity(growThreads);
        if (secIncrease2 === Infinity)
            return;
        const weaken2Threads = getWThreads(ns, secIncrease2);

        const totalThreads = weaken1Threads + weaken2Threads + growThreads + hackThreads;
	    const ramPerFrame = totalThreads * 1.75;

        let endAfter = startAfter + weakenTime;
        let startBefore = endAfter;

        const jobs = this.jobs = [];
        const frames = this.frames = [];

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

            const weaken1 = new Job(ns, target, WEAKEN, weaken1Threads, weaken1Start, null);
            const weaken2 = new Job(ns, target, WEAKEN, weaken2Threads, weaken2Start, weaken1);
            const growJob = new Job(ns, target, GROW, growThreads, growStart, weaken2);
            const hackJob = new Job(ns, target, HACK, hackThreads, hackStart, growJob);

            jobs.push(weaken1, weaken2, growJob, hackJob);
            frames.push(weaken1);

            ram -= ramPerFrame;
            endAfter = weaken2End + SUBTASK_SPACING;
        }
        this.jobs.sort(by('startTime'));
    }

    async tick() {
        const { jobs } = this;
        while (jobs.length > 0 && await (jobs[0].check()))
            jobs.shift();
    }

    getReservedThreads = () => this.jobs.map(job=>job.threads).reduce((a,b)=>a+b,0);
    hasEnded = () => this.jobs.length === 0;
    toString() {
        return 'BOOP';//this.jobs.length + ' ' + (this.jobs[0]?.startTime - Date.now());
    }
}

export default class Thief {
    constructor(ns, server) {
        this.ns = ns;
        this.server = server;
    }

    getHostname = () => this.server;
    canHack = () => {
        const hasRoot = this.ns.hasRootAccess(this.server);
        const maxServerLevel = Math.ceil(this.ns.getHackingLevel() / 2);
        const serverLevel = this.ns.getServerMinSecurityLevel(this.server);
        return hasRoot && serverLevel <= maxServerLevel;
    }

    canStartNextBatch = () => {
        if (this.currentBatch == null)
            return true;
        return this.currentBatch.hasEnded();
        // return this.currentBatch == null || this.currentBatch.hasEnded();
    }

    async startNextBatch(ram, maxProcessThreads) {
        const { ns, server } = this;
        this.currentBatch = new HWGWBatch(ns, server, .01, ram, this.currentBatch?.endAfter || Date.now());
        // ns.tprint(this.currentBatch.frames.map(f=>f.startTime - Date.now()));
        console.log(this.currentBatch);
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

    getReservedThreads = () => this.currentBatch == null ? 0 :
        this.currentBatch.getReservedThreads();

    printFrames() {
        if (this.currentBatch != null && !this.currentBatch.hasEnded())
            this.ns.print(this.currentBatch.toString());
    }
}
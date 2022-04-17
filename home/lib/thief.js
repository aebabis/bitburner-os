import { WEAKEN, GROW, HACK } from './etc/filenames';
import { delegateAny } from './lib/scheduler-delegate';
import { logger } from './lib/logger';
import { by } from './lib/util';
import getConfig from './lib/config';

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
    }

    async send() {
        const { script, threads, target, startTime } = this;
        const uuid = crypto.randomUUID();
        await delegateAny(this.ns, false, { startTime })(script, threads, target, uuid);
    }
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

const computeThreads = (ns, target, portion) => {
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
        return null;
    const weaken1Threads = getWThreads(ns, secIncrease1);

    const growFactor  = 1 / (1 - portion);
    const growThreads = Math.ceil(ns.growthAnalyze(target, growFactor));
    const secIncrease2 = ns.growthAnalyzeSecurity(growThreads);
    if (secIncrease2 === Infinity)
        return null;
    const weaken2Threads = getWThreads(ns, secIncrease2);

    return { weakenTime, growTime, hackTime, weaken1Threads, weaken2Threads, growThreads, hackThreads };
}

class Batch {
    constructor(ns, target) {
        this.ns = ns;
        this.target = target;
        this.jobs = [];
        this.type = this.constructor.name.replace('Batch', '');
    }

    addJobs(...jobs) {
        this.jobs.push(...jobs);
    }

    async tick() {
        const { jobs } = this;
        while (jobs.length > 0 && await (jobs[0].check()))
            jobs.shift();
    }

    async send() {
        const { jobs } = this;
        for (const job of jobs) {
            await job.send();
        }
    }
    getReservedThreads = () => this.jobs.map(job=>job.threads).reduce((a,b)=>a+b,0);
    hasEnded = () => new Date() >= this.endAfter;
    toString() {
        return this.target.padEnd(20) + ' ' + this.type + ' ' + this.jobs.length + ' ' + (this.endAfter - Date.now());
    }
}

class HGBatch extends Batch {
    constructor(ns, target, portion, ram, startAfter=Date.now()) {
        super(ns, target);
        if (isNaN(portion))
            throw new Error('Portion must be a number. Got ' + portion);
        if (isNaN(ram))
            throw new Error('Ram must be a number. Got ' + ram);
        if (portion > .5) {
            ns.tprint('WARN - Hack portion cannot exceed .5');
            portion = .5;
        }

        const frame = computeThreads(ns, target, portion);
        if (frame == null)
            return;
        
        const { growTime, hackTime, growThreads, hackThreads } = frame;

        this.portion = portion;

        const totalThreads = growThreads + hackThreads;
	    const ramPerFrame = totalThreads * 1.75;

        let endAfter = startAfter + growTime;
        let startBefore = endAfter;

        const frames = this.frames = [];

        if (hackThreads < 1)
            return;

        while (ram >= ramPerFrame) {
            const hackEnd = endAfter;
            const growEnd = hackEnd + SUBTASK_SPACING;
            const growStart = growEnd - growTime;
            const hackStart = hackEnd - hackTime;

            if (hackStart >= startBefore)
                break;

            const growJob = new Job(ns, target, GROW, growThreads, growStart, null);
            const hackJob = new Job(ns, target, HACK, hackThreads, hackStart, growJob);

            this.addJobs(growJob, hackJob);
            frames.push(growJob);

            ram -= ramPerFrame;
            endAfter = growEnd + SUBTASK_SPACING;
        }
        this.jobs.sort(by('startTime'));
        this.endAfter = endAfter;
    }
}

class HWGWBatch extends Batch {
    constructor(ns, target, portion, ram, startAfter=Date.now()) {
        super(ns, target);
        if (isNaN(portion))
            throw new Error('Portion must be a number. Got ' + portion);
        if (isNaN(ram))
            throw new Error('Ram must be a number. Got ' + ram);
        if (portion > .5) {
            ns.tprint('WARN - Hack portion cannot exceed .5');
            portion = .5;
        }

        const frame = computeThreads(ns, target, portion);
        if (frame == null)
            return;
        
        const { weakenTime, growTime, hackTime,
            weaken1Threads, weaken2Threads,
            growThreads, hackThreads } = frame;
        ns.print(`Planning batch ${weaken1Threads} ${weaken2Threads} ${growThreads} ${hackThreads}`);

        this.portion = portion;

        const totalThreads = weaken1Threads + weaken2Threads + growThreads + hackThreads;
	    const ramPerFrame = totalThreads * 1.75;

        let endAfter = startAfter + weakenTime;
        let startBefore = endAfter;

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

            this.addJobs(weaken1, weaken2, growJob, hackJob);
            frames.push(weaken1);

            ram -= ramPerFrame;
            endAfter = weaken2End + SUBTASK_SPACING;
        }
        this.jobs.sort(by('startTime'));
        this.endAfter = endAfter;
    }
}

class WGWBatch extends Batch {
    constructor(ns, target, ram, startAfter=Date.now()) {
        super(ns, target);
        if (isNaN(ram))
            throw new Error('Ram must be a number. Got ' + ram);
        
        const minSecurity = ns.getServerMinSecurityLevel(target);
        const curSecurity = ns.getServerSecurityLevel(target);
        let weaken1Threads = getWThreads(ns, curSecurity - minSecurity);

        const maxMoney = ns.getServerMaxMoney(target);
        const money = ns.getServerMoneyAvailable(target);

        if (maxMoney === 0)
            throw new Error('Cannot hack server with no money: ' + target);
        const portion = maxMoney / money;
        let growThreads = Math.ceil(ns.growthAnalyze(target, portion));

        const secBump = ns.growthAnalyzeSecurity(growThreads);
        let weaken2Threads = getWThreads(ns, secBump);

        const weaken1Start = startAfter;
        const weaken2Start = startAfter + 2 * SUBTASK_SPACING;
        const growStart = weaken1Start + ns.getWeakenTime(target) + SUBTASK_SPACING - ns.getGrowTime(target);

        const threadsPerJob = Math.max(8, ram/24/1.75/2);

        while (ram > 0 && weaken1Threads > 0) {
            const threads = Math.min(weaken1Threads, threadsPerJob);
            this.addJobs(new Job(ns, target, WEAKEN, threads, weaken1Start, null));
            weaken1Threads -= threads;
            ram -= threads * 1.75;
        }

        while (ram > 0 && growThreads > 0) {
            const threads = Math.min(growThreads, threadsPerJob);
            this.addJobs(new Job(ns, target, GROW, threads, growStart, null));
            growThreads -= threads;
            ram -= threads * 1.75;
        }

        while (ram > 0 && weaken2Threads > 0) {
            const threads = Math.min(weaken2Threads, threadsPerJob);
            this.addJobs(new Job(ns, target, WEAKEN, threads, weaken2Start, null));
            weaken2Threads -= threads;
            ram -= threads * 1.7;
        }
        this.jobs.sort(by('startTime'));
        this.endAfter = weaken2Start + ns.getWeakenTime(target) + SUBTASK_SPACING;
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

    isGroomed = () => {
        const maxMoney = this.ns.getServerMaxMoney(this.server);
        const money = this.ns.getServerMoneyAvailable(this.server);
        const minSecurity = this.ns.getServerMinSecurityLevel(this.server);
        const curSecurity = this.ns.getServerSecurityLevel(this.server);
        return money / maxMoney > .99 && curSecurity < minSecurity + 1;
    }

    canHG = () => {
        const minSecurity = this.ns.getServerMinSecurityLevel(this.server);
        const baseSecurity = this.ns.getServerBaseSecurityLevel(this.server);
        return minSecurity === baseSecurity;
    }

    canStartNextBatch = () => {
        if (this.currentBatch == null)
            return true;
        return this.currentBatch.hasEnded();
        // return this.currentBatch == null || this.currentBatch.hasEnded();
    }

    async startNextBatch(ram) {
        const { ns, server, currentBatch } = this;
        const endAfter = currentBatch ? currentBatch.endAfter : Date.now();

        if (!this.isGroomed())
            this.currentBatch = new WGWBatch(ns, server, ram, endAfter);
        else if (this.canHG())
            this.currentBatch = new HGBatch(ns, server, getConfig(ns).get('theft-portion'), ram, endAfter);
        else
            this.currentBatch = new HWGWBatch(ns, server, getConfig(ns).get('theft-portion'), ram, endAfter);
        await this.currentBatch.send();
        logger(ns).log('Started batch for ' + this.server);
    }

    getTableData() {
        const boolStr = b => b === true ? 'Y' : b === false ? 'N' : '-';
        const { server, currentBatch } = this;
        if (currentBatch == null) {
            return { hostname: server };
        }
        const { type, jobs } = currentBatch;
        const ended = boolStr(currentBatch.hasEnded());
        const timeLeft = (currentBatch.endAfter - Date.now()) / 1000;
        const minutes = Math.trunc(timeLeft / 60);
        const seconds = Math.floor(Math.abs(timeLeft % 60)).toString().padStart(2, '0');
        return { hostname: server, type, jobs: jobs.length, ended, timeLeft: `${minutes}:${seconds}` };
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
}
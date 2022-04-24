import { WEAKEN, GROW, HACK } from './etc/filenames';
import { createBatch } from './lib/scheduler-delegate';

const SUBTASK_SPACING = 50;
const FRAME_SPACING = SUBTASK_SPACING * 4;

const count = 64;
const e = Math.E;
const k = 20;
const x_0 = .5;
const PORTIONS = new Array(count + 1)
  .fill(null)
  .map((_,i) => i / count)
  .map((x) => 1-1/(1+e**(-1*k*(x-x_0))))

/** @param {NS} ns **/
const getWThreads = (ns, targetDecrease, cores=1) => {
    let threads = 1;
    while (ns.weakenAnalyze(threads, cores) < targetDecrease)
        threads++;
    return threads;
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

    if (portion <= 0 || portion >= 1)
        throw new Error(`Invalid theft portion: ${portion}`);

    let hackThreads = Math.floor(portion / ns.hackAnalyze(target));
    while (hackThreads < 1 && portion < 1) {
        portion += .01;
        hackThreads = Math.floor(portion / ns.hackAnalyze(target));
    }
    const secIncrease1 = ns.hackAnalyzeSecurity(hackThreads);
    if (secIncrease1 === Infinity)
        return null;

    const growFactor  = 1 / (1 - portion);
    const growThreads = Math.ceil(ns.growthAnalyze(target, growFactor));
    const secIncrease2 = ns.growthAnalyzeSecurity(growThreads);
    if (secIncrease2 === Infinity)
        return null;

    const weaken1Threads = getWThreads(ns, secIncrease1);
    const weaken2Threads = getWThreads(ns, secIncrease2);
    const weakenThreads = getWThreads(ns, weaken1Threads + weaken2Threads);

    return { weakenTime, growTime, hackTime, weaken1Threads, weaken2Threads, growThreads, hackThreads, weakenThreads };
}

class Batch {
    constructor(ns, target) {
        this.ns = ns;
        this.target = target;
        this.jobs = createBatch(ns);
        this.type = this.constructor.name.replace('Batch', '');
        this.threads = 0;
    }

    addJob(script, threads, target, startTime) {
        const uuid = crypto.randomUUID();
        this.jobs.delegateAny(startTime)(script, threads, target, uuid);
        this.threads += threads;
    }

    async tick() {
        const { jobs } = this;
        while (jobs.length > 0 && await (jobs[0].check()))
            jobs.shift();
    }

    async send() {
        await this.jobs.send();
    }
    getReservedThreads = () => this.hasEnded() ? 0 : this.threads;
    hasEnded = () => this.jobs.length === 0 || new Date() >= this.endAfter;
    toString() {
        return this.target.padEnd(20) + ' ' + this.type + ' ' + this.jobs.getSize() + ' ' + (this.endAfter - Date.now());
    }
}

class HGWBatch extends Batch {
    constructor(ns, target, portion, ram, startAfter=Date.now()) {
        super(ns, target);
        if (isNaN(portion))
            throw new Error('Portion must be a number. Got ' + portion);
        if (isNaN(ram))
            throw new Error('Ram must be a number. Got ' + ram);
        if (portion >= 1) {
            ns.tprint('WARN - Hack portion cannot meet or exceed 1');
            portion = 63/64;
        }

        const frame = computeThreads(ns, target, portion);
        if (frame == null)
            return;
        
        const { weakenTime, growTime, hackTime, weakenThreads, growThreads, hackThreads } = frame;
        this.frame = [weakenThreads, growThreads, hackThreads];

        this.portion = portion;

        const totalThreads = weakenThreads + growThreads + hackThreads;
	    const ramPerFrame = totalThreads * 1.75;

        let endAfter = startAfter + weakenTime;
        let startBefore = endAfter;

        if (hackThreads < 1)
            return;

        while (ram >= ramPerFrame) {
            const hackEnd = endAfter;
            const weakenEnd = hackEnd + SUBTASK_SPACING;
            const growEnd = weakenEnd + SUBTASK_SPACING;

            const weakenStart = weakenEnd - weakenTime;
            const growStart = growEnd - growTime;
            const hackStart = hackEnd - hackTime;

            if (hackStart >= startBefore)
                break;

            this.addJob(WEAKEN, weakenThreads, target, weakenStart);
            this.addJob(GROW, growThreads, target, growStart);
            this.addJob(HACK, hackThreads, target, hackStart);

            ram -= ramPerFrame;
            endAfter = weakenEnd + FRAME_SPACING;
        }
        this.endAfter = endAfter;
        if (this.jobs.getSize() === 0)
            this.endAfter = Date.now();
    }
}

class HWGWBatch extends Batch {
    constructor(ns, target, portion, ram, startAfter=Date.now()) {
        super(ns, target);
        if (isNaN(portion))
            throw new Error('Portion must be a number. Got ' + portion);
        if (isNaN(ram))
            throw new Error('Ram must be a number. Got ' + ram);
        if (portion >= 1) {
            ns.tprint('WARN - Hack portion cannot meet or exceed 1');
            portion = 63/64;
        }

        const frame = computeThreads(ns, target, portion);
        if (frame == null)
            return;
        
        const { weakenTime, growTime, hackTime,
            weaken1Threads, weaken2Threads,
            growThreads, hackThreads } = frame;
        this.frame = [weaken1Threads, weaken2Threads, growThreads, hackThreads];

        this.portion = portion;

        const totalThreads = weaken1Threads + weaken2Threads + growThreads + hackThreads;
	    const ramPerFrame = totalThreads * 1.75;

        let endAfter = startAfter + weakenTime;
        let startBefore = endAfter;

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

            this.addJob(WEAKEN, weaken1Threads, target, weaken1Start);
            this.addJob(WEAKEN, weaken2Threads, target, weaken2Start);
            this.addJob(GROW, growThreads, target, growStart);
            this.addJob(HACK, hackThreads, target, hackStart);

            ram -= ramPerFrame;
            endAfter = weaken2End + FRAME_SPACING;
        }
        this.endAfter = endAfter;
        if (this.jobs.getSize() === 0)
            this.endAfter = Date.now();
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
        const money = ns.getServerMoneyAvailable(target) || 1;

        if (maxMoney === 0)
            throw new Error('Cannot hack server with no money: ' + target);
        const portion = maxMoney / money;
        let growThreads = Math.ceil(ns.growthAnalyze(target, portion));

        const secBump = ns.growthAnalyzeSecurity(growThreads);
        let weaken2Threads = getWThreads(ns, secBump);

        this.frame = [weaken1Threads, weaken2Threads, growThreads];

        const weaken1Start = startAfter;
        const weaken2Start = startAfter + 2 * SUBTASK_SPACING;
        const growStart = weaken1Start + ns.getWeakenTime(target) + SUBTASK_SPACING - ns.getGrowTime(target);

        const threadsPerJob = Math.max(8, Math.ceil(ram/24/1.75/2));

        while (ram > 0 && weaken1Threads > 0) {
            const threads = Math.min(weaken1Threads, threadsPerJob);
            this.addJob(WEAKEN, threads, target, weaken1Start);
            weaken1Threads -= threads;
            ram -= threads * 1.75;
        }

        while (ram > 0 && growThreads > 0) {
            const threads = Math.min(growThreads, threadsPerJob);
            this.addJob(GROW, threads, target, growStart);
            growThreads -= threads;
            ram -= threads * 1.75;
        }

        while (ram > 0 && weaken2Threads > 0) {
            const threads = Math.min(weaken2Threads, threadsPerJob);
            this.addJob(WEAKEN, threads, target, weaken2Start);
            weaken2Threads -= threads;
            ram -= threads * 1.7;
        }
        this.endAfter = weaken2Start + ns.getWeakenTime(target) + FRAME_SPACING;
        if (this.jobs.getSize() === 0)
            this.endAfter = Date.now();
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

    isGrooming = () => {
        const { currentBatch } = this;
        if (currentBatch == null || currentBatch.hasEnded())
            return false;
        return currentBatch.type === 'WGW';
    }

    isStealing = () => {
        const { currentBatch } = this;
        if (currentBatch == null || currentBatch.hasEnded())
            return false;
        return currentBatch.type !== 'WGW';
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

    async startNextBatch(ram, maxRamPerJob) {
        const { ns, server, currentBatch } = this;
        const endAfter = currentBatch ? currentBatch.endAfter : Date.now();

        if (!this.isGroomed()) {
            this.currentBatch = new WGWBatch(ns, server, ram, endAfter);
        } else {
            const maxThreads = maxRamPerJob / 1.75;
            const portion = PORTIONS.find((portion) => {
                const growThreads = ns.growthAnalyze(server, 1 / (1-portion));
                const hackThreads = portion/ns.hackAnalyze(server);
                return growThreads < maxThreads && hackThreads < maxThreads;
            });
            if (portion <= 0)
                return false;
            if (this.canHG())
                this.currentBatch = new HGWBatch(ns, server, portion, ram, endAfter);
            else
                this.currentBatch = new HWGWBatch(ns, server, portion, ram, endAfter);
        }
        await this.currentBatch.send();
        return this.currentBatch.jobs.length > 0;
    }

    getTableData() {
        const boolStr = b => b === true ? 'Y' : b === false ? 'N' : '-';
        const { server, currentBatch } = this;
        if (currentBatch == null) {
            return { hostname: server };
        }
        const { type, jobs, frame = [], portion } = currentBatch;
        const ended = boolStr(currentBatch.hasEnded());
        const timeLeft = (currentBatch.endAfter - Date.now()) / 1000;
        const sign = Math.sign(timeLeft) === -1 ? '-' : '';
        const minutes = Math.floor(Math.abs(timeLeft / 60));
        const seconds = Math.floor(Math.abs(timeLeft % 60)).toString().padStart(2, '0');
        return { hostname: server, type, jobs: jobs.getSize(), ended, portion, timeLeft: `${sign}${minutes}:${seconds}`, frame: frame.join(' ') };
    }

    getDesirability() {
        const { ns, server } = this;
        if (server === 'n00dles')
            return Infinity;

        const weakenTime = ns.getWeakenTime(server);
        const maxMoney = ns.getServerMaxMoney(server);

        const portion = .01;
        const income = maxMoney * portion;

        const hackThreads = Math.floor(portion / ns.hackAnalyze(server));
        const growFactor  = 1 / (1 - portion);
        const growThreads = Math.ceil(ns.growthAnalyze(server, growFactor));

        return income / (growThreads + hackThreads) / weakenTime / weakenTime;
    }

    getReservedThreads = () => this.currentBatch == null ? 0 :
        this.currentBatch.getReservedThreads();
}
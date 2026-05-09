import { WEAKEN, GROW, HACK } from "../etc/filenames";
import { createBatch } from "./scheduler-delegate";

const _win = globalThis;

const SUBTASK_SPACING = 50;
const FRAME_SPACING = SUBTASK_SPACING * 4;
export const HORIZON_MS = 30 * 60 * 1000;

const count = 64;
const e = Math.E;
const k = 20;
const x_0 = 0.5;
const PORTIONS = new Array(count + 1)
  .fill(null)
  .map((_, i) => i / count)
  .map((x) => 1 - 1 / (1 + e ** (-1 * k * (x - x_0))));

/** @param {NS} ns
 *  @param {string} target */
const getTimes = (ns, target) => {
  if (ns.fileExists("Formulas.exe", "home")) {
    const server = /** @type {Server} */ ({
      hackDifficulty: ns.getServerMinSecurityLevel(target),
      requiredHackingSkill: ns.getServerRequiredHackingLevel(target),
    });
    const hackTime = ns.formulas.hacking.hackTime(server, ns.getPlayer());
    return { hackTime, growTime: hackTime * 3.2, weakenTime: hackTime * 4 };
  }
  const minSec = ns.getServerMinSecurityLevel(target);
  const curSec = ns.getServerSecurityLevel(target);
  const ratio = minSec / curSec;
  return {
    hackTime: ns.getHackTime(target) * ratio,
    growTime: ns.getGrowTime(target) * ratio,
    weakenTime: ns.getWeakenTime(target) * ratio,
  };
};

/** @param {NS} ns
 *  @param {number} targetDecrease
 *  @param {number} [cores]
 */
const getWThreads = (ns, targetDecrease, cores = 1) => {
  let threads = 1;
  while (ns.weakenAnalyze(threads, cores) < targetDecrease) threads++;
  return threads;
};

/** @param {NS} ns
 *  @param {string} target
 *  @param {number} portion
 */
const computeThreads = (ns, target, portion) => {
  if (portion <= 0 || portion >= 1)
    throw new Error(`Invalid theft portion: ${portion}`);

  let hackThreads = Math.floor(portion / ns.hackAnalyze(target));
  while (hackThreads < 1 && portion < 1) {
    portion += 0.01;
    hackThreads = Math.floor(portion / ns.hackAnalyze(target));
  }
  const secIncrease1 = ns.hackAnalyzeSecurity(hackThreads);
  if (secIncrease1 === Infinity) return null;

  const growFactor = 1 / (1 - portion);
  const growThreads = Math.ceil(ns.growthAnalyze(target, growFactor));
  const secIncrease2 = ns.growthAnalyzeSecurity(growThreads);
  if (secIncrease2 === Infinity) return null;

  return {
    ...getTimes(ns, target),
    weaken1Threads: getWThreads(ns, secIncrease1),
    weaken2Threads: getWThreads(ns, secIncrease2),
    growThreads,
    hackThreads,
  };
};

class Batch {
  /** @param {NS} ns @param {string} target */
  constructor(ns, target) {
    this.ns = ns;
    this.target = target;
    this.jobs = createBatch(ns);
    this.type = this.constructor.name.replace("Batch", "");
    this.threads = 0;
    this._profilerRecords = /** @type {[string, string, string, string, number, number, number][]} */ ([]);
    this.endAfter = /** @type {number | null} */ (null);
    this.frame = /** @type {number[] | undefined} */ (undefined);
    this.portion = /** @type {number | undefined} */ (undefined);
  }

  /** @param {string} frameId @param {string} jobId @param {string} target @param {string} label @param {number} threads @param {number} startTime @param {number} endTime */
  _queueProfiler(frameId, jobId, target, label, threads, startTime, endTime) {
    this._profilerRecords.push([frameId, jobId, target, label, threads, startTime, endTime]);
  }

  /** @param {string} script @param {number} threads @param {string} target @param {number} startTime @param {string} jobId */
  addJob(script, threads, target, startTime, jobId = crypto.randomUUID()) {
    this.jobs.delegateAny(startTime)(script, threads, target, jobId);
    this.threads += threads;
  }

  async send() {
    const _p = _win.__profiler;
    if (_p) {
      for (const args of this._profilerRecords) {
        _p.recordScheduled?.(...args);
      }
    }
    await this.jobs.send();
  }

  getReservedThreads = () => (this.hasEnded() ? 0 : this.threads);
  hasEnded = () => !this.endAfter || Date.now() >= this.endAfter;

  toString() {
    return (
      this.target.padEnd(20) +
      " " +
      this.type +
      " " +
      this.jobs.getSize() +
      " " +
      ((this.endAfter ?? 0) - Date.now())
    );
  }
}

class HWGWBatch extends Batch {
  /** @param {NS} ns @param {string} target @param {number} portion @param {number} ram @param {number} startAfter @param {number} maxFrames */
  constructor(
    ns,
    target,
    portion,
    ram,
    startAfter = Date.now(),
    maxFrames = Infinity,
  ) {
    super(ns, target);

    if (portion >= 1) portion = 63 / 64;

    const frame = computeThreads(ns, target, portion);
    if (frame == null || frame.hackThreads < 1) return;

    const {
      weakenTime,
      growTime,
      hackTime,
      weaken1Threads,
      weaken2Threads,
      growThreads,
      hackThreads,
    } = frame;

    this.frame = [weaken1Threads, weaken2Threads, growThreads, hackThreads];
    this.portion = portion;

    const totalThreads =
      weaken1Threads + weaken2Threads + growThreads + hackThreads;
    const ramPerFrame = totalThreads * 1.75;

    let endAfter = startAfter + weakenTime;
    let framesAdded = 0;

    while (ram >= ramPerFrame && framesAdded < maxFrames) {
      const hackEnd = endAfter;
      const weaken1End = hackEnd + SUBTASK_SPACING;
      const growEnd = weaken1End + SUBTASK_SPACING;
      const weaken2End = growEnd + SUBTASK_SPACING;

      const frameId = crypto.randomUUID();
      const hackId = crypto.randomUUID();
      const w1Id = crypto.randomUUID();
      const growId = crypto.randomUUID();
      const w2Id = crypto.randomUUID();

      this._queueProfiler(frameId, hackId, target, "H", hackThreads, hackEnd - hackTime, hackEnd);
      this._queueProfiler(frameId, w1Id, target, "W1", weaken1Threads, weaken1End - weakenTime, weaken1End);
      this._queueProfiler(frameId, growId, target, "G", growThreads, growEnd - growTime, growEnd);
      this._queueProfiler(frameId, w2Id, target, "W2", weaken2Threads, weaken2End - weakenTime, weaken2End);

      this.addJob(HACK, hackThreads, target, hackEnd - hackTime, hackId);
      this.addJob(
        WEAKEN,
        weaken1Threads,
        target,
        weaken1End - weakenTime,
        w1Id,
      );
      this.addJob(GROW, growThreads, target, growEnd - growTime, growId);
      this.addJob(
        WEAKEN,
        weaken2Threads,
        target,
        weaken2End - weakenTime,
        w2Id,
      );

      ram -= ramPerFrame;
      endAfter = weaken2End + FRAME_SPACING;
      framesAdded++;
    }

    this.endAfter = this.jobs.getSize() > 0 ? endAfter : Date.now();
  }
}

class WGWBatch extends Batch {
  /** @param {NS} ns @param {string} target @param {number} ram @param {number} startAfter */
  constructor(ns, target, ram, startAfter = Date.now()) {
    super(ns, target);

    const minSecurity = ns.getServerMinSecurityLevel(target);
    const curSecurity = ns.getServerSecurityLevel(target);
    let weaken1Threads = getWThreads(ns, curSecurity - minSecurity);

    const maxMoney = ns.getServerMaxMoney(target);
    const money = ns.getServerMoneyAvailable(target) || 1;

    if (maxMoney === 0)
      throw new Error("Cannot hack server with no money: " + target);
    const portion = maxMoney / money;
    let growThreads = Math.ceil(ns.growthAnalyze(target, portion));

    const secBump = ns.growthAnalyzeSecurity(growThreads);
    let weaken2Threads = getWThreads(ns, secBump);

    this.frame = [weaken1Threads, weaken2Threads, growThreads];

    // Use current-security times here: WGWBatch runs on an ungroomed server,
    // so the actual weaken duration is longer than the min-security estimate.
    const weakenTime = ns.getWeakenTime(target);
    const growTime = ns.getGrowTime(target);

    const weaken1Start = startAfter;
    const weaken2Start = startAfter + 2 * SUBTASK_SPACING;
    const growStart =
      weaken1Start + weakenTime + SUBTASK_SPACING - growTime;

    const threadsPerJob = Math.max(8, Math.ceil(ram / 24 / 1.75 / 2));

    const frameId = crypto.randomUUID();

    while (ram > 0 && weaken1Threads > 0) {
      const threads = Math.min(weaken1Threads, threadsPerJob);
      const jobId = crypto.randomUUID();
      this._queueProfiler(frameId, jobId, target, "W1", threads, weaken1Start, weaken1Start + weakenTime);
      this.addJob(WEAKEN, threads, target, weaken1Start, jobId);
      weaken1Threads -= threads;
      ram -= threads * 1.75;
    }

    while (ram > 0 && growThreads > 0) {
      const threads = Math.min(growThreads, threadsPerJob);
      const jobId = crypto.randomUUID();
      this._queueProfiler(frameId, jobId, target, "G", threads, growStart, growStart + growTime);
      this.addJob(GROW, threads, target, growStart, jobId);
      growThreads -= threads;
      ram -= threads * 1.75;
    }

    while (ram > 0 && weaken2Threads > 0) {
      const threads = Math.min(weaken2Threads, threadsPerJob);
      const jobId = crypto.randomUUID();
      this._queueProfiler(frameId, jobId, target, "W2", threads, weaken2Start, weaken2Start + weakenTime);
      this.addJob(WEAKEN, threads, target, weaken2Start, jobId);
      weaken2Threads -= threads;
      ram -= threads * 1.75;
    }

    this.endAfter = weaken2Start + weakenTime + FRAME_SPACING;
    if (this.jobs.getSize() === 0) this.endAfter = Date.now();
  }
}

export default class Thief {
  /** @param {NS} ns
   *  @param {string} server */
  constructor(ns, server) {
    this.ns = ns;
    this.server = server;
    this.batches = /** @type {Batch[]} */ ([]);
  }

  getHostname = () => this.server;

  canHack = () => {
    const hasRoot = this.ns.hasRootAccess(this.server);
    const requiredLevel = this.ns.getServerRequiredHackingLevel(this.server);
    return hasRoot && requiredLevel <= this.ns.getHackingLevel();
  };

  isGroomed = () => {
    const maxMoney = this.ns.getServerMaxMoney(this.server);
    const money = this.ns.getServerMoneyAvailable(this.server);
    const minSecurity = this.ns.getServerMinSecurityLevel(this.server);
    const curSecurity = this.ns.getServerSecurityLevel(this.server);
    return money / maxMoney > 0.99 && curSecurity < minSecurity + 1;
  };

  isGrooming = () => {
    const { currentBatch } = this;
    if (currentBatch == null || currentBatch.hasEnded()) return false;
    return currentBatch.type === "WGW";
  };

  isStealing = () => {
    const { currentBatch } = this;
    if (currentBatch == null || currentBatch.hasEnded()) return false;
    return currentBatch.type !== "WGW";
  };

  canStartNextBatch = () => !this.currentBatch || this.currentBatch.hasEnded();

  isPipelining = () =>
    this.currentBatch != null && !this.currentBatch.hasEnded();

  /** @param {number} ram @param {number} maxRamPerJob */
  async startNextBatch(ram, maxRamPerJob) {
    const { ns, server, currentBatch } = this;
    const endAfter = Math.max(currentBatch?.endAfter ?? Date.now(), Date.now());

    // When pipelining, server state is mid-batch (post-hack, pre-grow/weaken).
    // The current HWGW will restore groomed state by endAfter, so trust it.
    if (!this.isPipelining() && !this.isGroomed()) {
      this.currentBatch = new WGWBatch(ns, server, ram, endAfter);
    } else {
      const maxThreads = maxRamPerJob / 1.75;
      const portion = PORTIONS.find((portion) => {
        const growThreads = ns.growthAnalyze(server, 1 / (1 - portion));
        const hackThreads = portion / ns.hackAnalyze(server);
        return growThreads < maxThreads && hackThreads < maxThreads;
      });
      if (portion == null) return false;
      this.currentBatch = new HWGWBatch(ns, server, portion, ram, endAfter);
    }
    await this.currentBatch.send();
    this.batches = [...this.batches, this.currentBatch].filter((batch) => !batch.hasEnded());
    return this.currentBatch.jobs.getSize() > 0;
  }

  getTableData() {
    const { server, batches, currentBatch } = this;
    if (currentBatch == null) return { hostname: server };
    return batches.filter((batch) => !batch.hasEnded()).map((batch) => {
      const { type, jobs, frame = [], portion } = batch;
      const timeLeft = ((batch.endAfter ?? 0) - Date.now()) / 1000;
      const sign = Math.sign(timeLeft) === -1 ? "-" : "";
      const minutes = Math.floor(Math.abs(timeLeft / 60));
      const seconds = Math.floor(Math.abs(timeLeft % 60))
        .toString()
        .padStart(2, "0");
      return {
        hostname: server,
        type,
        jobs: jobs.getSize(),
        portion,
        timeLeft: `${sign}${minutes}:${seconds}`,
        frame: frame.join(" "),
      };
    });
  }

  /** @param {number} ramAvailable */
  estimateGroomTime(ramAvailable) {
    const { ns, server } = this;
    const minSec = ns.getServerMinSecurityLevel(server);
    const curSec = ns.getServerSecurityLevel(server);
    const money = ns.getServerMoneyAvailable(server) || 1;
    const maxMoney = ns.getServerMaxMoney(server);
    const weaken1Threads = getWThreads(ns, curSec - minSec);
    const growThreads = Math.ceil(ns.growthAnalyze(server, maxMoney / money));
    const weaken2Threads = getWThreads(ns, ns.growthAnalyzeSecurity(growThreads));
    const totalThreads = weaken1Threads + growThreads + weaken2Threads;
    const minPasses = Math.ceil((totalThreads * 1.75) / ramAvailable);
    return minPasses * ns.getWeakenTime(server);
  }

  /** @param {number} timeToAug @param {number} ramAvailable */
  getDesirability(timeToAug = HORIZON_MS, ramAvailable = Infinity) {
    const { ns, server } = this;

    const durationOfIncome = timeToAug - this.estimateGroomTime(ramAvailable);

    const { weakenTime } = getTimes(ns, server);
    const maxMoney = ns.getServerMaxMoney(server);
    const portion = 0.01;

    const hackThreads = Math.floor(portion / ns.hackAnalyze(server));
    const growFactor = 1 / (1 - portion);
    const growThreads = Math.ceil(ns.growthAnalyze(server, growFactor));

    const incomePerBatch = maxMoney * portion;
    const batchesInHorizon = Math.floor(durationOfIncome / weakenTime);
    return (incomePerBatch * batchesInHorizon) / (hackThreads + growThreads);
  }

  getWeakenTime() {
    const { ns, server } = this;
    return getTimes(ns, server).weakenTime;
  }

  getReservedThreads = () =>
    this.currentBatch == null ? 0 : this.currentBatch.getReservedThreads();

  toString = () => `Thief<${this.server}> ${this.currentBatch}`;
}

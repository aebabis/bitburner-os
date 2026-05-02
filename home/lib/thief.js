import { WEAKEN, GROW, HACK } from "../etc/filenames";
import { createBatch } from "./scheduler-delegate";

const _win = globalThis;

const SUBTASK_SPACING = 50;
const FRAME_SPACING = SUBTASK_SPACING * 4;
const HORIZON_MS = 30 * 60 * 1000;

const count = 64;
const e = Math.E;
const k = 20;
const x_0 = 0.5;
const PORTIONS = new Array(count + 1)
  .fill(null)
  .map((_, i) => i / count)
  .map((x) => 1 - 1 / (1 + e ** (-1 * k * (x - x_0))));

const getWThreads = (ns, targetDecrease, cores = 1) => {
  let threads = 1;
  while (ns.weakenAnalyze(threads, cores) < targetDecrease) threads++;
  return threads;
};

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
    weakenTime: ns.getWeakenTime(target),
    growTime: ns.getGrowTime(target),
    hackTime: ns.getHackTime(target),
    weaken1Threads: getWThreads(ns, secIncrease1),
    weaken2Threads: getWThreads(ns, secIncrease2),
    growThreads,
    hackThreads,
  };
};

class Batch {
  constructor(ns, target) {
    this.ns = ns;
    this.target = target;
    this.jobs = createBatch(ns);
    this.type = this.constructor.name.replace("Batch", "");
    this.threads = 0;
  }

  addJob(script, threads, target, startTime, jobId = crypto.randomUUID()) {
    this.jobs.delegateAny(startTime)(script, threads, target, jobId);
    this.threads += threads;
  }

  async send() {
    await this.jobs.send();
  }

  getReservedThreads = () => (this.hasEnded() ? 0 : this.threads);
  hasEnded = () => !this.endAfter || new Date() >= this.endAfter;

  toString() {
    return (
      this.target.padEnd(20) +
      " " +
      this.type +
      " " +
      this.jobs.getSize() +
      " " +
      (this.endAfter - Date.now())
    );
  }
}

class HWGWBatch extends Batch {
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

      const _p = _win.__profiler;
      if (_p) {
        _p.recordScheduled?.(
          frameId,
          hackId,
          target,
          "H",
          hackThreads,
          hackEnd - hackTime,
          hackEnd,
        );
        _p.recordScheduled?.(
          frameId,
          w1Id,
          target,
          "W1",
          weaken1Threads,
          weaken1End - weakenTime,
          weaken1End,
        );
        _p.recordScheduled?.(
          frameId,
          growId,
          target,
          "G",
          growThreads,
          growEnd - growTime,
          growEnd,
        );
        _p.recordScheduled?.(
          frameId,
          w2Id,
          target,
          "W2",
          weaken2Threads,
          weaken2End - weakenTime,
          weaken2End,
        );
      }

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

    const weaken1Start = startAfter;
    const weaken2Start = startAfter + 2 * SUBTASK_SPACING;
    const growStart =
      weaken1Start +
      ns.getWeakenTime(target) +
      SUBTASK_SPACING -
      ns.getGrowTime(target);

    const threadsPerJob = Math.max(8, Math.ceil(ram / 24 / 1.75 / 2));

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
      ram -= threads * 1.75;
    }

    this.endAfter = weaken2Start + ns.getWeakenTime(target) + FRAME_SPACING;
    if (this.jobs.getSize() === 0) this.endAfter = Date.now();
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

  canStartNextBatch = () => {
    if (!this.currentBatch || this.currentBatch.hasEnded()) return true;
    if (this.currentBatch.type !== "HWGW") return false;
    // Allow scheduling next frame one weaken cycle before current ends so there's no gap.
    return (
      Date.now() >=
      this.currentBatch.endAfter - this.ns.getWeakenTime(this.server)
    );
  };

  async startNextBatch(ram, maxRamPerJob) {
    const { ns, server, currentBatch } = this;
    const endAfter = currentBatch?.endAfter ?? Date.now();

    if (!this.isGroomed()) {
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
    return this.currentBatch.jobs.getSize() > 0;
  }

  getTableData() {
    const { server, currentBatch } = this;
    if (currentBatch == null) return { hostname: server };
    const { type, jobs, frame = [], portion } = currentBatch;
    const timeLeft = (currentBatch.endAfter - Date.now()) / 1000;
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
  }

  estimateGroomTime(ramAvailable) {
    const { ns, server } = this;
    const wgwBatch = new WGWBatch(ns, server, ramAvailable);
    const minPasses = (wgwBatch.threads * 1.75) / ramAvailable;
    return minPasses * ns.getWeakenTime(server);
  }

  getDesirability(timeToAug = HORIZON_MS, ramAvailable = Infinity) {
    const { ns, server } = this;

    const durationOfIncome = timeToAug - this.estimateGroomTime(ramAvailable);

    const weakenTime = ns.getWeakenTime(server);
    const maxMoney = ns.getServerMaxMoney(server);
    const portion = 0.01;

    const hackThreads = Math.floor(portion / ns.hackAnalyze(server));
    const growFactor = 1 / (1 - portion);
    const growThreads = Math.ceil(ns.growthAnalyze(server, growFactor));

    const incomePerBatch = maxMoney * portion;
    const batchesInHorizon = Math.floor(durationOfIncome / weakenTime);
    return (incomePerBatch * batchesInHorizon) / (hackThreads + growThreads);
  }

  getReservedThreads = () =>
    this.currentBatch == null ? 0 : this.currentBatch.getReservedThreads();

  toString = () => `Thief<${this.server}> ${this.currentBatch}`;
}

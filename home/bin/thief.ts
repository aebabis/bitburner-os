import { HORIZON_MS, THREADPOOL } from '../etc/config';
import { HACK, GROW, WEAK } from '../etc/filenames';
import { getHostnames, getMoneyData, putMoneyData } from '../lib/data-store';
import { buildWorkerThreadAllocator } from '../lib/ram';
import { getWorkerRam, HACKER_POLICY } from '../lib/ram-router';

const getRootServerRam = (ns: NS) => getWorkerRam(ns, HACK, HACKER_POLICY(ns));

const SPACING = 50;
const FRAME_SPACING = 200;
const PROC_LIMIT = 60000;
const FRAME_LIMIT = Math.floor(PROC_LIMIT / 4);

// Weaken reduces security by 0.05 per thread (base rate)
const getWeakThreads = (secDecrease: number) => Math.ceil(secDecrease / 0.05);

const needsSetup = (ns: NS, hostname: string) => {
  const minSec = ns.getServerMinSecurityLevel(hostname);
  const curSec = ns.getServerSecurityLevel(hostname);
  const money = ns.getServerMoneyAvailable(hostname);
  const maxMoney = ns.getServerMaxMoney(hostname);
  return (curSec - minSec) / minSec > 0.1 || money / maxMoney < 0.95;
};

const getPossibleTargets = (ns: NS) =>
  getHostnames(ns).filter((hostname) => {
    if (
      hostname === 'home' ||
      hostname.startsWith('hacknet-node-') ||
      hostname.startsWith(THREADPOOL) ||
      !ns.hasRootAccess(hostname)
    ) {
      return false;
    }
    const maxMoney = ns.getServerMaxMoney(hostname);
    const requiredHackingSkill = ns.getServerRequiredHackingLevel(hostname);
    return ns.getHackingLevel() >= requiredHackingSkill && maxMoney > 0;
  });

const getSetupTime = (ns: NS, hostname: string, totalRam: number) => {
  const maxMoney = ns.getServerMaxMoney(hostname);
  const money = Math.max(ns.getServerMoneyAvailable(hostname), 1);
  const totalGrowThreads = Math.ceil(ns.growthAnalyze(hostname, maxMoney / money));
  const threadsPerPass = Math.max(1, Math.floor(totalRam / (1.75 * 2)));
  return Math.ceil(totalGrowThreads / threadsPerPass) * (ns.getWeakenTime(hostname) + SPACING);
};

const getFrame = (ns: NS, hostname: string, totalRam: number, hackThreads: number) => {
  const weakTime = ns.getWeakenTime();
  const hackPortion = ns.hackAnalyze(hostname);
  if (hackPortion * hackThreads >= 1) {
    return null;
  }
  const growFactor = 1 / (1 - hackThreads * hackPortion);
  const growThreads = Math.ceil(ns.growthAnalyze(hostname, growFactor));
  const weak1Threads = getWeakThreads(0.002); // hack security per thread
  const weak2Threads = getWeakThreads(2 * 0.002 * growThreads);
  const frameRam = hackThreads * 1.7 + (weak1Threads + growThreads + weak2Threads) * 1.75;
  const concurrentFrames = Math.ceil((weakTime + 3 * SPACING) / FRAME_SPACING);
  const peakRam = concurrentFrames * frameRam;
  const numFrames = Math.min(Math.floor(totalRam / frameRam), FRAME_LIMIT);
  return {
    hackThreads,
    growThreads,
    weak1Threads,
    weak2Threads,
    frameRam,
    numFrames,
    peakRam,
  };
};

const evaluateTarget = (ns: NS, hostname: string, totalRam: number) => {
  const maxMoney = ns.getServerMaxMoney(hostname);
  if (maxMoney === 0) return { hostname, money: 0, time: Infinity, incomeRate: 0, utility: 0 };
  const hackPortion = ns.hackAnalyze(hostname);
  if (hackPortion === 0) return { hostname, money: 0, time: Infinity, incomeRate: 0, utility: 0 };
  const growFactor = 1 / (1 - hackPortion);
  const growThreads = Math.ceil(ns.growthAnalyze(hostname, growFactor));
  const weak1Threads = getWeakThreads(0.002); // hack security per thread
  const weak2Threads = getWeakThreads(2 * 0.002 * growThreads);
  const frameRam = 1.7 + (weak1Threads + growThreads + weak2Threads) * 1.75;
  const numFrames = Math.max(0, Math.floor(totalRam / frameRam));
  const money = maxMoney * hackPortion * numFrames;
  const time = ns.getWeakenTime(hostname);
  const earningTime = HORIZON_MS - getSetupTime(ns, hostname, totalRam);
  const utility = Math.max(0, Math.floor(earningTime / time)) * money;
  return {
    hostname,
    money,
    time,
    incomeRate: time === 0 ? 0 : money / (time / 1000),
    utility,
  };
};

const getTarget = (ns: NS) => {
  const totalRam = Object.values(getRootServerRam(ns)).reduce((a, b) => a + b, 0);
  const evaluations = getPossibleTargets(ns).map((hostname) =>
    evaluateTarget(ns, hostname, totalRam),
  );
  if (evaluations.length === 0) return null;
  const best = evaluations.reduce((a, b) => (a.utility > b.utility ? a : b));
  return best.utility > 0 ? best : null;
};

let workerId = 0;

export async function main(ns: NS) {
  ns.disableLog('ALL');

  const result = getTarget(ns);
  if (result == null) {
    await ns.sleep(1000);
    return;
  }

  const { hostname: target, money, time, incomeRate } = result;
  const hackTime = ns.getHackTime(target);
  const growTime = ns.getGrowTime(target);
  const weakTime = ns.getWeakenTime(target);

  const execWorker = (
    script: string,
    hostname: string,
    threads: number,
    additionalMsec: number,
  ) => {
    const pid = ns.exec(
      script,
      hostname,
      { threads, temporary: true },
      target,
      additionalMsec,
      `${workerId++}`,
    );
    if (!pid) throw new Error(`exec fail: ${script} ${hostname} ${threads} ${target}`);
  };

  const makeAssign = (ramSnapshot: Record<string, number>) => {
    const alloc = buildWorkerThreadAllocator(ramSnapshot);
    return (script: string, threads: number, additionalMsec: number): (() => void) | null => {
      if (threads === 0) return () => {};
      const allocations: [string, number][] = [];
      let rem = threads;
      while (rem > 0) {
        const allocation = alloc(rem, script === HACK ? 1.7 : 1.75);
        if (!allocation) return null;
        allocations.push(allocation);
        rem -= allocation[1];
      }
      return () => {
        for (const [hostname, t] of allocations) execWorker(script, hostname, t, additionalMsec);
      };
    };
  };

  // Run queue: each entry holds jobs to exec at a specific time.
  // For WGW setup: one pass per queue entry, sequential until groomed.
  // For HWGW: pipelined frames launched every FRAME_PERIOD ms.
  type QueueEntry = {
    execAt: number;
    jobs: { script: string; threads: number; additionalMsec: number }[];
    frameDuration: number;
  };
  const queue: QueueEntry[] = [];

  if (needsSetup(ns, target)) {
    const secDiff = ns.getServerSecurityLevel(target) - ns.getServerMinSecurityLevel(target);
    const initWeakThreads = secDiff > 0 ? getWeakThreads(secDiff) : 0;
    const totalRam = Object.values(getRootServerRam(ns)).reduce((a, b) => a + b, 0);
    // Reserve RAM for initWeak, split remainder evenly between grow and weak2.
    const growRamBudget = (totalRam - initWeakThreads * 1.75) / 2;
    const maxGrowThreads = Math.max(1, Math.floor(growRamBudget / 1.75));
    const maxMoney = ns.getServerMaxMoney(target);
    const currentMoney = Math.max(ns.getServerMoneyAvailable(target), 1);
    const growFactor = maxMoney / currentMoney;
    const growThreads = Math.min(maxGrowThreads, Math.ceil(ns.growthAnalyze(target, growFactor)));
    const weak2Threads = getWeakThreads(2 * 0.002 * growThreads);

    // One WGW pass: initWeak ends at +weakTime, grow ends at +weakTime+SPACING,
    // weak2 ends at +weakTime+SPACING (same window — both fix their respective security).
    queue.push({
      execAt: Date.now(),
      jobs: [
        ...(initWeakThreads > 0
          ? [{ script: WEAK, threads: initWeakThreads, additionalMsec: 0 }]
          : []),
        {
          script: GROW,
          threads: growThreads,
          additionalMsec: weakTime - growTime + SPACING,
        },
        { script: WEAK, threads: weak2Threads, additionalMsec: SPACING },
      ],
      frameDuration: weakTime + SPACING,
    });
  } else {
    const totalRam = Object.values(getRootServerRam(ns)).reduce((a, b) => a + b, 0);
    const maxFrames = Math.min(FRAME_LIMIT, Math.floor(weakTime / SPACING));

    let frame = getFrame(ns, target, totalRam, 1)!;
    for (let i = 1; true; i++) {
      const nextBiggest = getFrame(ns, target, totalRam, i);
      if (nextBiggest == null) break;
      if (nextBiggest.numFrames > maxFrames || nextBiggest.peakRam < 0.9 * totalRam) {
        frame = nextBiggest;
      } else {
        break;
      }
    }

    const { hackThreads, growThreads, weak1Threads, weak2Threads, numFrames } = frame;

    // Frames are pipelined: launch one every FRAME_PERIOD, each with the same
    // small additionalMsec offsets. RAM is shared across all concurrent frames.
    const frameDuration = weakTime + 3 * SPACING;
    for (let i = 0; i < numFrames; i++) {
      queue.push({
        execAt: Date.now() + i * FRAME_SPACING,
        jobs: [
          { script: HACK, threads: hackThreads, additionalMsec: weakTime - hackTime },
          { script: WEAK, threads: weak1Threads, additionalMsec: SPACING },
          {
            script: GROW,
            threads: growThreads,
            additionalMsec: weakTime - growTime + 2 * SPACING,
          },
          { script: WEAK, threads: weak2Threads, additionalMsec: 3 * SPACING },
        ],
        frameDuration,
      });
    }
  }

  const endTime = Date.now() + weakTime + queue.length * FRAME_SPACING;
  putMoneyData(ns, { theft: { target, money, time, incomeRate, endTime } });

  const updateMoneyData = () => {
    const { onlineMoneyMade } = ns.getRunningScript()!;
    const theftIncome = onlineMoneyMade / (weakTime / 1000);
    if (theftIncome > getMoneyData(ns).theftIncome) {
      putMoneyData(ns, { theftIncome, theftRatePerGB: theftIncome / ramUsed });
    }
  };

  // Sleep loop: exec each queued frame at its scheduled time.
  let ramUsed = 0;
  let lastEndTime = Date.now();
  for (const entry of queue) {
    const delay = entry.execAt - Date.now();
    if (delay > 0) await ns.sleep(delay);
    updateMoneyData();

    const assign = makeAssign(getRootServerRam(ns));
    const runners = entry.jobs.map(({ script, threads, additionalMsec }) => {
      ramUsed += threads * (script === HACK ? 1.7 : 1.75);
      return assign(script, threads, additionalMsec);
    });
    if (runners.some((r) => r == null)) break;
    for (const runner of runners) runner!();

    lastEndTime = entry.execAt + entry.frameDuration;
  }

  // Sleep until the last scheduled job finishes.
  await ns.sleep(Math.max(0, lastEndTime - Date.now()));
  updateMoneyData();
}

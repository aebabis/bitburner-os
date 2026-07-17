import { HORIZON_MS, THREADPOOL } from '../etc/config';
import { ERROR } from '../lib/colors';
import { getHostnames, putMoneyData } from '../lib/data-store';
import { getWorkerRam, HACKER_POLICY } from '../lib/ram-router';
import { getGoals } from '../lib/goals/goals';
import { buildWorkerThreadAllocator } from '../lib/ram';
import { table } from '../lib/table';
import { by } from '../lib/util';
import { HACK, GROW, WEAK } from '../etc/filenames';

const PROC_LIMIT = 60000;
const FRAME_LIMIT = Math.floor(PROC_LIMIT / 3);

type HackableServer = Server & {
  moneyAvailable: number;
  moneyMax: number;
  minDifficulty: number;
  hackDifficulty: number;
  requiredHackingSkill: number;
};

const getHackableServer = (ns: NS, hostname: string): HackableServer => {
  const server = ns.getServer(hostname);
  if (
    hostname === 'home' ||
    typeof server.moneyAvailable !== 'number' ||
    typeof server.moneyMax !== 'number' ||
    typeof server.minDifficulty !== 'number' ||
    typeof server.hackDifficulty !== 'number' ||
    typeof server.requiredHackingSkill !== 'number'
  ) {
    throw new Error('Not a hackable server');
  }
  return server as HackableServer;
};

const getRootServerRam = (ns: NS) => getWorkerRam(ns, HACK, HACKER_POLICY);

const getWeakThreads = (ns: NS, targetDecrease: number) => {
  let threads = 1;
  while (ns.formulas.hacking.weakenEffect(threads) < targetDecrease) threads++;
  return threads;
};

const getHgwFrame = (ns: NS, server: HackableServer, minFrameRam: number) => {
  let hackThreads = 1;
  while (true) {
    const hackPortion = ns.hackAnalyze(server.hostname) * hackThreads;
    const hackSecurity = ns.hackAnalyzeSecurity(hackThreads, server.hostname);
    const serverH = {
      ...server,
      moneyAvailable: server.moneyAvailable - server.moneyMax * hackPortion,
      hackDifficulty: server.hackDifficulty + hackSecurity,
    };
    const growThreads = ns.formulas.hacking.growThreads(serverH, ns.getPlayer(), server.moneyMax);
    const growSecurity = ns.growthAnalyzeSecurity(growThreads);
    const weakThreads = getWeakThreads(ns, hackSecurity + growSecurity);
    const frameRam = hackThreads * 1.7 + growThreads * 1.75 + weakThreads * 1.75;
    if (frameRam >= minFrameRam) return [hackThreads, growThreads, weakThreads];
    else hackThreads++;
  }
};

function* getHgwBatch(ns: NS, server: HackableServer, minFrameRam: number) {
  const frame = getHgwFrame(ns, server, minFrameRam);
  while (true) yield frame;
}

const getGwFrame = (ns: NS, minFrameRam: number) => {
  for (let growThreads = 1; ; growThreads++) {
    const growSecurity = ns.growthAnalyzeSecurity(growThreads);
    const weakThreads = getWeakThreads(ns, growSecurity);
    const frameRam = (growThreads + weakThreads) * 1.75;
    if (frameRam >= minFrameRam) return [growThreads, weakThreads];
  }
};

function* getWgwBatch(ns: NS, server: HackableServer, minFrameRam: number) {
  if (!needsSetup(server)) return;
  const initWeakThreads = getWeakThreads(ns, server.hackDifficulty - server.minDifficulty);
  const serverW = {
    ...server,
    hackDifficulty: server.minDifficulty,
    moneyAvailable: Math.max(server.moneyAvailable, 1),
  };
  const totalGrowThreads = ns.formulas.hacking.growThreads(
    serverW,
    ns.getPlayer(),
    server.moneyMax,
  );
  const [growThreads, weakThreads] = getGwFrame(ns, minFrameRam);
  const numAddlFrames = Math.ceil(totalGrowThreads / growThreads);
  yield [0, 0, initWeakThreads];
  for (let i = 0; i < numAddlFrames; i++) yield [0, growThreads, weakThreads];
  yield* getHgwBatch(
    ns,
    {
      ...server,
      moneyAvailable: server.moneyMax,
      hackDifficulty: server.minDifficulty,
    },
    minFrameRam,
  );
}

const needsSetup = (server: HackableServer) =>
  (server.hackDifficulty - server.minDifficulty) / server.minDifficulty > 0.1 ||
  server.moneyAvailable / server.moneyMax < 0.95;

const getSetupTime = (ns: NS, hostname: string, minFrameRam: number) => {
  const server = getHackableServer(ns, hostname);
  const threadsAvail = Object.values(getRootServerRam(ns))
    .map((ram) => Math.floor(ram / 1.75))
    .reduce((a, b) => a + b, 0);
  let rtt = 0;
  let threadsRem = 0;
  for (const [hackThreads, growThreads, weakThreads] of getWgwBatch(ns, server, minFrameRam)) {
    if (hackThreads) break;
    const frameThreads = growThreads + weakThreads;
    if (frameThreads <= threadsRem) {
      threadsRem -= frameThreads;
    } else {
      threadsRem = threadsAvail - frameThreads;
      rtt++;
    }
  }
  return rtt * ns.formulas.hacking.weakenTime(server, ns.getPlayer());
};

const evaluateTarget = (ns: NS, horizon = HORIZON_MS, hostname: string, minFrameRam: number) => {
  const server = getHackableServer(ns, hostname);
  if (server.moneyMax === 0) {
    return { hostname, money: 0, time: Infinity, incomeRate: 0, utility: 0 };
  }
  const whenReady = {
    ...server,
    moneyAvailable: server.moneyMax,
    hackDifficulty: server.minDifficulty,
  };
  const [hackThreads, growThreads, weakThreads] = getHgwFrame(ns, whenReady, 0);
  const frameRam = hackThreads * 1.7 + growThreads * 1.75 + weakThreads * 1.75;
  const numFrames = Object.values(getRootServerRam(ns))
    .map((ram) => Math.floor(ram / frameRam))
    .reduce((a, b) => a + b, 0);
  const hackPercent = ns.formulas.hacking.hackPercent(whenReady, ns.getPlayer());
  const money = server.moneyMax * hackPercent * hackThreads * numFrames;
  const time = ns.formulas.hacking.weakenTime(server, ns.getPlayer());
  const earningTime = horizon - getSetupTime(ns, hostname, minFrameRam);
  const utility = Math.floor(earningTime / time) * money;
  return {
    hostname,
    money,
    time,
    incomeRate: time === 0 ? 0 : money / (time / 1000),
    utility,
  };
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
    const { requiredHackingSkill, moneyMax } = getHackableServer(ns, hostname);
    return ns.getHackingLevel() >= requiredHackingSkill && moneyMax > 0;
  });

const getHorizon = (ns: NS) =>
  Math.min(HORIZON_MS, (getGoals(ns).timeToComplete() || Infinity) * 1000);

const selectTarget = (ns: NS, minFrameRam: number) => {
  const evaluations = getPossibleTargets(ns).map((hostname) =>
    evaluateTarget(ns, getHorizon(ns), hostname, minFrameRam),
  );
  if (evaluations.length === 0) {
    return { hostname: null, money: 0, time: 0, incomeRate: 0 };
  }
  return evaluations.reduce((a, b) => (a.utility > b.utility ? a : b));
};

const printTable = (ns: NS) => {
  const serverRam = getRootServerRam(ns);
  const totalRamAvailable = Object.values(serverRam).reduce((a, b) => a + b, 0);
  // Minimum ram size of HGW frame to prevent too many processes
  const minFrameRam = totalRamAvailable / FRAME_LIMIT;
  const horizon = getHorizon(ns);
  const columns = ['HOSTNAME', '$/RUN', 's/RUN', '$/s', 'UTILITY'];
  const rows = getPossibleTargets(ns)
    .map((hostname) => evaluateTarget(ns, horizon, hostname, minFrameRam))
    .sort(by((evaluation) => -evaluation.utility))
    .map((evaluation) => [
      evaluation.hostname,
      `$${ns.format.number(evaluation.money, 1)}`,
      Math.ceil(evaluation.time / 1000),
      `$${ns.format.number(evaluation.incomeRate, 1)}`,
      Math.round(evaluation.utility),
    ]);
  ns.tprint('\n\n' + table(ns, columns, rows, { colors: true }) + '\n\n');
};

let workerId = 0;

export async function main(ns: NS) {
  ns.disableLog('ALL');

  const DEBUG = false;
  const debug = DEBUG ? ns.tprint : () => {};

  if (ns.args[0]) {
    printTable(ns);
    return;
  } else if (DEBUG) {
    printTable(ns);
  }

  const exec = (script: string, hostname: string, threads: number, additionalMsec: number) => {
    const jobId = `${workerId++}`;
    ns.exec(script, hostname, { threads, temporary: true }, target!, additionalMsec, jobId, DEBUG);
  };

  const totalRamAvailable = Object.values(getRootServerRam(ns)).reduce((a, b) => a + b, 0);
  // Minimum ram size of HGW frame to prevent too many processes
  const minFrameRam = totalRamAvailable / FRAME_LIMIT;
  debug('Total: ' + ns.format.ram(totalRamAvailable));
  debug('Limit: ' + FRAME_LIMIT);
  debug('Frame: ' + ns.format.ram(minFrameRam));

  const { hostname: target, money, time, incomeRate } = selectTarget(ns, minFrameRam);

  if (target == null) {
    await ns.sleep(1000);
    return;
  }

  const server = getHackableServer(ns, target);
  debug(needsSetup(server));
  const batch = needsSetup(server)
    ? getWgwBatch(ns, server, minFrameRam)
    : getHgwBatch(ns, server, minFrameRam);

  const hackTime = ns.getHackTime(target);
  const growTime = ns.getGrowTime(target);
  const weakTime = ns.getWeakenTime(target);
  const endTime = Date.now() + weakTime;

  putMoneyData(ns, { theft: { target, money, time, incomeRate, endTime } });

  const alloc = buildWorkerThreadAllocator(getRootServerRam(ns));

  let totalRam = 0;
  const assign = (script: string, threads: number, additionalMsec: number) => {
    if (threads === 0) return () => {};
    if (additionalMsec < 0) return null;
    const allocations: [string, number][] = [];
    let threadsRemaining = threads;
    while (threadsRemaining > 0) {
      const allocation = alloc(threadsRemaining, script === HACK ? 1.7 : 1.75);
      if (allocation == null) return null;
      totalRam += allocation[1] * (script === HACK ? 1.7 : 1.75);
      allocations.push(allocation);
      threadsRemaining -= allocation[1];
    }
    return () => {
      for (const [hostname, threads] of allocations)
        exec(script, hostname, threads, additionalMsec);
    };
  };

  let frameCount = 0;
  let lastSleep = Date.now();
  for (const [hackThreads, growThreads, weakThreads] of batch) {
    frameCount++;
    if (frameCount > FRAME_LIMIT) {
      ns.tprint(ERROR + 'Exceeded frame limit of ' + FRAME_LIMIT);
      break;
    }
    const hack = assign(HACK, hackThreads, weakTime - hackTime);
    const grow = assign(GROW, growThreads, weakTime - growTime);
    const weak = assign(WEAK, weakThreads, weakTime - weakTime);
    if (hack && grow && weak) {
      hack();
      grow();
      weak();
    } else {
      break;
    }
    if (Date.now() - lastSleep > 200) {
      await ns.sleep(0);
      lastSleep = Date.now();
    }
  }

  await ns.sleep(1); // Wait for worker tick to finish before sleeping
  await ns.sleep(weakTime);

  const { onlineMoneyMade } = ns.getRunningScript()!;
  const theftIncome = onlineMoneyMade / (weakTime / 1000);
  putMoneyData(ns, { theftIncome, theftRatePerGB: theftIncome / totalRam });
}

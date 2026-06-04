import { HORIZON_MS, THREADPOOL } from '../etc/config';
import { getHostnames, putMoneyData } from '../lib/data-store';
import { getGoals } from '../lib/goals/goals';
import { initProfiler } from '../lib/profiler';

const HACK = 'bin/workers/hackshot.ts';
const GROW = 'bin/workers/growshot.ts';
const WEAK = 'bin/workers/weakshot.ts';

const SCRIPT_TYPE: Record<string, string> = {
  [HACK]: 'H',
  [GROW]: 'G',
  [WEAK]: 'W1',
};

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

const getRootServers = (ns: NS) => getHostnames(ns).filter(ns.hasRootAccess);
const getRootServerRam = (ns: NS) =>
  getRootServers(ns).reduce<Record<string, number>>((ram, hostname) => {
    const { maxRam, ramUsed } = ns.getServer(hostname);
    ram[hostname] = maxRam - ramUsed;
    if (hostname === 'home') ram[hostname] = Math.max(0, ram[hostname] - 32);
    return ram;
  }, {});

const getWeakThreads = (ns: NS, targetDecrease: number) => {
  let threads = 1;
  while (ns.formulas.hacking.weakenEffect(threads) < targetDecrease) threads++;
  return threads;
};

function* getHgwBatch(ns: NS, server: HackableServer, hackThreads: number) {
  const hackPortion = ns.hackAnalyze(server.hostname) * hackThreads;
  const hackSecurity = ns.hackAnalyzeSecurity(hackThreads, server.hostname);
  const serverH = {
    ...server,
    moneyAvailable: server.moneyAvailable - server.moneyMax * hackPortion,
    hackDifficulty: server.hackDifficulty + hackSecurity,
  };
  const growThreads = ns.formulas.hacking.growThreads(
    serverH,
    ns.getPlayer(),
    server.moneyMax,
  );
  const growSecurity = ns.growthAnalyzeSecurity(growThreads);
  const weakThreads = getWeakThreads(ns, hackSecurity + growSecurity);
  while (true) yield [hackThreads, growThreads, weakThreads];
}

function* getWgwBatch(ns: NS, server: HackableServer, windowMs: number) {
  const initWeakThreads = getWeakThreads(
    ns,
    server.hackDifficulty - server.minDifficulty,
  );
  const serverW = { ...server, hackDifficulty: server.minDifficulty };
  const totalGrowThreads = ns.formulas.hacking.growThreads(
    serverW,
    ns.getPlayer(),
    server.moneyMax,
  );
  const growThreads = Math.ceil(totalGrowThreads / windowMs);
  const growSecurity = ns.growthAnalyzeSecurity(growThreads);
  const weakThreads = getWeakThreads(ns, growSecurity);
  const numAddlFrames = Math.ceil(totalGrowThreads / growThreads);
  yield [0, 0, initWeakThreads];
  for (let i = 0; i < numAddlFrames; i++) yield [0, growThreads, weakThreads];
}

const needsSetup = (ns: NS, hostname: string) => {
  const server = getHackableServer(ns, hostname);
  return (
    (server.hackDifficulty - server.minDifficulty) / server.minDifficulty >
      0.1 || server.moneyAvailable / server.moneyMax < 0.95
  );
};

const evaluateTarget = (
  ns: NS,
  horizon = HORIZON_MS,
  windowMs: number,
  hostname: string,
  hackThreads = 1,
) => {
  const server = getHackableServer(ns, hostname);
  if (server.moneyMax === 0) {
    return { hostname, money: 0, time: Infinity, incomeRate: 0, utility: 0 };
  }
  const whenReady = {
    ...server,
    moneyAvailable: server.moneyMax,
    hackDifficulty: server.minDifficulty,
  };
  const [, growThreads, weakThreads] = getHgwBatch(
    ns,
    whenReady,
    hackThreads,
  ).next().value!;
  const frameRam = hackThreads * 1.7 + growThreads * 1.75 + weakThreads * 1.75;
  const numFrames = Object.values(getRootServerRam(ns))
    .map((ram) => Math.floor(ram / frameRam))
    .reduce((a, b) => a + b, 0);
  const hackPercent = ns.formulas.hacking.hackPercent(
    whenReady,
    ns.getPlayer(),
  );
  const money = server.moneyMax * hackPercent * hackThreads * numFrames;
  const time =
    ns.formulas.hacking.weakenTime(server, ns.getPlayer()) + windowMs;
  const earningTime =
    horizon - (needsSetup(ns, hostname) ? ns.getWeakenTime(hostname) : 0);
  const utility = Math.floor(earningTime / time) * money;
  return {
    hostname,
    money,
    time,
    incomeRate: time === 0 ? 0 : money / time,
    utility,
  };
};

const getPossibleTargets = (ns: NS) =>
  getHostnames(ns).filter(
    (hostname) =>
      hostname !== 'home' &&
      !hostname.startsWith('hacknet-node-') &&
      !hostname.startsWith(THREADPOOL) &&
      ns.getHackingLevel() >=
        getHackableServer(ns, hostname).requiredHackingSkill &&
      getHackableServer(ns, hostname).moneyMax > 0 &&
      ns.hasRootAccess(hostname),
  );

const selectTarget = (ns: NS, windowMs: number) => {
  const goalTree = getGoals(ns);
  const horizon = Math.min(HORIZON_MS, goalTree.timeToComplete() || Infinity);
  const evaluations = getPossibleTargets(ns).map((hostname) =>
    evaluateTarget(ns, horizon, windowMs, hostname),
  );
  if (evaluations.length === 0) throw new Error('No hackable targets?!');
  return evaluations.reduce((a, b) => (a.utility > b.utility ? a : b));
};

let workerId = 0;

export async function main(ns: NS) {
  initProfiler();
  ns.disableLog('ALL');

  const DEBUG = false;
  const DELAY = 1000;

  const frame = `${Date.now()}`;

  const { hostname: target, money, time, incomeRate } = selectTarget(ns, DELAY);

  const batch = needsSetup(ns, target)
    ? getWgwBatch(ns, getHackableServer(ns, target), DELAY)
    : getHgwBatch(ns, getHackableServer(ns, target), 1);

  const hackTime = ns.getHackTime(target);
  const growTime = ns.getGrowTime(target);
  const weakTime = ns.getWeakenTime(target);
  const endTime = Date.now() + weakTime + DELAY;

  putMoneyData(ns, { theft: { target, money, time, incomeRate, endTime } });

  const exec = (
    script: string,
    hostname: string,
    threads: number,
    baseStartTime: number,
  ) => {
    const jobId = `${workerId++}`;
    if (
      !ns.exec(script, hostname, threads, target, baseStartTime, jobId, DEBUG)
    ) {
      throw new Error(
        `Failed to start ${script} ${hostname} ${threads} ${target}`,
      );
    }
    globalThis.__profiler.recordScheduled(
      frame,
      jobId,
      hostname,
      SCRIPT_TYPE[script] ?? script,
      threads,
      Date.now(),
      endTime,
    );
  };

  let offsetMS = 0;

  const hosts = getRootServers(ns);
  const serverRam = getRootServerRam(ns);
  let totalRam = 0;

  for (const [hackThreads, growThreads, weakThreads] of batch) {
    const frameRam =
      hackThreads * 1.7 + growThreads * 1.75 + weakThreads * 1.75;
    const hostname = hosts.find((hostname) => serverRam[hostname] > frameRam);
    if (hostname == null) break;
    if (offsetMS >= DELAY - 50) break;
    const offset = offsetMS++ + 0.0001;
    hackThreads &&
      exec(HACK, hostname, hackThreads, endTime - hackTime - offset);
    growThreads &&
      exec(GROW, hostname, growThreads, endTime - growTime - offset);
    weakThreads &&
      exec(WEAK, hostname, weakThreads, endTime - weakTime - offset);
    serverRam[hostname] -= frameRam;
    totalRam += frameRam;
  }

  await ns.sleep(endTime - Date.now());
  const { onlineMoneyMade } = ns.getRunningScript()!;
  const theftIncome = onlineMoneyMade / ((weakTime + DELAY) / 1000);
  ns.tprint('$' + ns.format.number(onlineMoneyMade, 1));
  putMoneyData(ns, { theftIncome, theftRatePerGB: theftIncome / totalRam });
}

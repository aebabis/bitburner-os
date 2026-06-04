import { putMoneyData } from '../lib/data-store';
import { initProfiler } from '../lib/profiler';

const HACK = 'bin/workers/hackshot.ts';
const GROW = 'bin/workers/growshot.ts';
const WEAK = 'bin/workers/weakshot.ts';

type HackableServer = Server & {
  moneyAvailable: number;
  moneyMax: number;
  minDifficulty: number;
  hackDifficulty: number;
};

const getHackableServer = (ns: NS, hostname: string): HackableServer => {
  const server = ns.getServer(hostname);
  if (
    hostname === 'home' ||
    typeof server.moneyAvailable !== 'number' ||
    typeof server.moneyMax !== 'number' ||
    typeof server.minDifficulty !== 'number' ||
    typeof server.hackDifficulty !== 'number'
  ) {
    throw new Error('Not a hackable server');
  }
  return server as HackableServer;
};

const getWeakThreads = (ns: NS, targetDecrease: number) => {
  let threads = 1;
  while (ns.formulas.hacking.weakenEffect(threads) < targetDecrease) threads++;
  return threads;
};

function* getHgwBatch(ns: NS, hostname: string, hackThreads: number) {
  const server = getHackableServer(ns, hostname);
  const hackPortion = ns.hackAnalyze(hostname) * hackThreads;
  const hackSecurity = ns.hackAnalyzeSecurity(hackThreads, hostname);
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

function* getWgwBatch(ns: NS, hostname: string, windowMs: number) {
  const server = getHackableServer(ns, hostname);
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

let workerId = 0;

export async function main(ns: NS) {
  initProfiler();
  ns.disableLog('ALL');

  const DEBUG = false;
  const DELAY = 1000;

  let [target = 'phantasy'] = ns.args as string[];

  const server = getHackableServer(ns, target);
  const needsSetup =
    (server.hackDifficulty - server.minDifficulty) / server.minDifficulty >
      0.1 || server.moneyAvailable / server.moneyMax < 0.95;
  const batch = needsSetup
    ? getWgwBatch(ns, target, DELAY)
    : getHgwBatch(ns, target, 1);

  const hackTime = ns.getHackTime(target);
  const growTime = ns.getGrowTime(target);
  const weakTime = ns.getWeakenTime(target);
  const endTime = Date.now() + weakTime + DELAY;

  const exec = (
    script: string,
    hostname: string,
    threads: number,
    baseStartTime: number,
  ) => {
    if (
      !ns.exec(
        script,
        hostname,
        threads,
        target,
        baseStartTime,
        workerId++,
        DEBUG,
      )
    ) {
      throw new Error(
        `Failed to start ${script} ${hostname} ${threads} ${target}`,
      );
    }
  };

  let offsetMS = 0;

  const hosts = ns.cloud.getServerNames();
  const serverRam = hosts.reduce<Record<string, number>>((ram, hostname) => {
    const { maxRam, ramUsed } = ns.getServer(hostname);
    ram[hostname] = maxRam - ramUsed;
    return ram;
  }, {});

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
  }

  await ns.sleep(endTime - Date.now());
  const { onlineMoneyMade } = ns.getRunningScript()!;
  const theftIncome = onlineMoneyMade / ((weakTime + DELAY) / 1000);
  putMoneyData(ns, { theftIncome });
}

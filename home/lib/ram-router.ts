import { by } from './util';
import {
  getHostnames,
  getPlayerData,
  getRamPolicy,
  putRamPolicy,
  RamPolicySnapshot,
} from './data-store';
import { THREADPOOL } from '../etc/config';
import { CHARGE, HACK, SHARE } from '../etc/filenames';

const getHomeReserveRam = (ns: NS) => {
  const POOL1 = `${THREADPOOL}-01`;
  const MIN_HOME_RESERVE = 2.1; // Enough for majority of /usr
  const MAX_HOME_RESERVE = 16; // Enough for everything except bitflume
  const hostnames = getHostnames(ns);
  const homeRam = ns.getServerMaxRam('home');
  const pool1Ram = hostnames.includes(POOL1) ? ns.getServerMaxRam(POOL1) : 0;
  return Math.min(Math.max(MIN_HOME_RESERVE, (homeRam + pool1Ram) / 10), MAX_HOME_RESERVE);
};

export const takeSnapshot = (
  ns: NS,
  currentServiceRam: number,
  isLoveRunning: boolean,
  isStanekRunning: boolean,
) => {
  const { currentWork } = getPlayerData(ns);
  const totalRam = getHostnames(ns)
    .filter(ns.hasRootAccess)
    .map(ns.getServerMaxRam)
    .reduce((a, b) => a + b, 0);
  const homeReserve = getHomeReserveRam(ns);
  const shouldShare = currentWork == null || currentWork.type === 'FACTION' || !isLoveRunning;
  const workerRam = Math.max(0, totalRam - currentServiceRam - homeReserve);
  const allottedShareRam = shouldShare ? workerRam * 0.1 : 0;
  const allottedStanekRam = isStanekRunning ? workerRam * 0.1 : 0;
  const allottedBatchRam = workerRam - allottedShareRam - allottedStanekRam;
  const snapshot: RamPolicySnapshot = {
    totalRam,
    homeReserve,
    currentServiceRam,
    allottedShareRam,
    allottedStanekRam,
    allottedBatchRam,
  };
  putRamPolicy(ns, snapshot);
};

type ExecResult = {
  pid: number;
  hostname: string | null;
  threads: number;
};

export const execOnBestServer = (
  ns: NS,
  script: string,
  host: string | null,
  threadOrOptions: number | RunOptions,
  highPriority: boolean,
  args: ScriptArg[] = [],
  scriptRam = ns.getScriptRam(script, 'home'),
): ExecResult => {
  const numThreads =
    typeof threadOrOptions === 'number' ? threadOrOptions : (threadOrOptions.threads ?? 1);
  const ramRequired = scriptRam * numThreads;

  if (host != null) {
    const unusedRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
    const reservedRam = host === 'home' && !highPriority ? getHomeReserveRam(ns) : 0;
    const availableRam = Math.max(0, unusedRam - reservedRam);
    if (ramRequired <= availableRam) {
      const pid = ns.exec(script, host, threadOrOptions, ...args);
      if (pid !== 0) return { pid, hostname: host, threads: numThreads };
    }
    return { pid: 0, hostname: null, threads: 0 };
  }

  const eligibleServers = getHostnames(ns)
    .filter(ns.hasRootAccess)
    .filter((hostname) => ns.getScriptRam(script, hostname) > 0)
    .map((hostname) => {
      const maxRam = ns.getServerMaxRam(hostname);
      const ramUsed = ns.getServerUsedRam(hostname);
      const ramUnused = maxRam - ramUsed;
      const reservedRam = hostname === 'home' && !highPriority ? getHomeReserveRam(ns) : 0;
      const ramAvailable = ramUnused - reservedRam;
      return { hostname, ramAvailable };
    })
    .filter(({ ramAvailable }) => ramAvailable >= scriptRam)
    .sort(by((s) => s.ramAvailable));

  // .at(-1) fallback only happens for multiple-thread exec jobs which in practice never happen.
  // Typical case is to run on smallest server that can fit single thread.
  const server =
    eligibleServers.find(({ ramAvailable }) => ramAvailable >= ramRequired) ||
    eligibleServers.at(-1);
  if (server != null) {
    const maxThreads = Math.floor(server.ramAvailable / scriptRam);
    const threads = Math.min(numThreads, maxThreads);
    const options = typeof threadOrOptions === 'object' ? { ...threadOrOptions, threads } : threads;
    if (threads > 0) {
      const pid = ns.exec(script, server.hostname, options, ...args);
      if (pid !== 0) return { pid, hostname: server.hostname, threads };
    }
  }

  return { pid: 0, hostname: null, threads: 0 };
};

type WorkerType = typeof CHARGE | typeof HACK | typeof SHARE;
export const getWorkerRamState = (ns: NS, workerType: WorkerType) => {
  const normalScript = workerType.startsWith('/') ? workerType : '/' + workerType;
  const scriptRam = ns.getScriptRam(workerType);
  const snapshot = getRamPolicy(ns);
  const rootHostnames = getHostnames(ns).filter(ns.hasRootAccess);

  if (snapshot == null) {
    return {
      targetRamUse: 0,
      currentWorkers: [],
      currentRamUse: 0,
      targetThreads: 0,
      currentThreads: 0,
      unusedRam: {},
    };
  }

  const targetRamUse =
    workerType === CHARGE
      ? snapshot.allottedStanekRam
      : workerType === SHARE
        ? snapshot.allottedShareRam
        : snapshot.allottedBatchRam;
  const targetThreads = Math.floor(targetRamUse / scriptRam);

  // Determine RAM already used by given service type.
  const currentWorkers = rootHostnames.flatMap((hostname) =>
    ns.ps(hostname).filter((ps) => ps.filename === normalScript),
  );
  const currentThreads = currentWorkers.map((ps) => ps.threads).reduce((a, b) => a + b, 0);
  const currentRamUse = currentThreads * scriptRam;

  const unusedRam = Object.fromEntries(
    rootHostnames.map((hostname) => {
      const maxRam = ns.getServerMaxRam(hostname);
      const ramUsed = ns.getServerUsedRam(hostname);
      const ramUnused = maxRam - ramUsed;
      const ramReserved = hostname === 'home' ? getHomeReserveRam(ns) : 0;
      const ramAvailable = Math.max(0, ramUnused - ramReserved);
      return [hostname, ramAvailable];
    }),
  );

  return {
    targetRamUse,
    currentWorkers,
    currentRamUse,
    currentThreads,
    targetThreads,
    unusedRam,
  };
};

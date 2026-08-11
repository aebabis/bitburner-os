import { by } from './util';
import {
  getHostnames,
  getPlayerData,
  getRamPolicy,
  getStaticData,
  putRamPolicy,
  RamPolicySnapshot,
} from './data-store';
import { THREADPOOL } from '../etc/config';
import { CHARGE, GROW, HACK, SHARE, WEAK } from '../etc/filenames';

const getHomeReserveRam = (ns: NS) => {
  const POOL1 = `${THREADPOOL}-01`;
  const MIN_HOME_RESERVE = 2.1; // Enough for majority of /usr
  const MAX_HOME_RESERVE = 20; // Enough for everything except bitflume
  const hostnames = getHostnames(ns);
  const homeRam = ns.getServerMaxRam('home');
  const pool1Ram = hostnames.includes(POOL1) ? ns.getServerMaxRam(POOL1) : 0;
  return Math.min(Math.max(MIN_HOME_RESERVE, (homeRam + pool1Ram) / 10), MAX_HOME_RESERVE);
};

// Worker RAM is split three ways. Batch takes the remainder, so only these are named.
const SHARE_ALLOTMENT = 0.1;
const STANEK_ALLOTMENT = 0.1;

const getWorkerRam = (totalRam: number, currentServiceRam: number, homeReserve: number) =>
  Math.max(0, totalRam - currentServiceRam - homeReserve);

/** RAM a host can offer charge workers. Measured from max rather than current usage,
 *  so the figure does not fall away as stanek fills the host. */
const getChargeCapacity = (ns: NS, hostname: string, homeReserve: number) =>
  Math.max(0, ns.getServerMaxRam(hostname) - (hostname === 'home' ? homeReserve : 0));

/** Stanek charges with a single process and its effect scales on that one process's
 *  thread count, so the whole allotment belongs on the largest single host rather than
 *  spread across the network. THREADPOOL-01 is excluded because `infect.ts` fullInfects
 *  it, making it the one pool server whose RAM services can take.
 *
 *  Ranked on max RAM rather than capacity, because both home and purchased servers only
 *  ever double: any host that is larger at all is at least twice as large, which no core
 *  bonus can overturn (8 cores is 1.4375x). That leaves cores relevant only to ties, and
 *  home takes those — it holds at least as many cores as a purchased server's one. The
 *  tie only pays off if home's cores have been upgraded, which nothing here does
 *  automatically. At one core home is the worse pick by the home reserve, which costs
 *  most when home is small: 64GB home against a 64GB pool server is ~9% of effect, a
 *  1TB pair under 1%. */
const getStanekHost = (ns: NS) => {
  const POOL1 = `${THREADPOOL}-01`;
  const candidates = getHostnames(ns).filter(
    (hostname) =>
      hostname.startsWith(THREADPOOL) && hostname !== POOL1 && ns.hasRootAccess(hostname),
  );
  return ['home', ...candidates].reduce((best, hostname) =>
    ns.getServerMaxRam(hostname) > ns.getServerMaxRam(best) ? hostname : best,
  );
};

/** Charge's allotment, capped by what its one host can physically hold. Recomputed from
 *  live host RAM rather than read back from the snapshot, so a server upgraded during a
 *  long batch is picked up on stanek's next tick. Safe to move under a frozen snapshot
 *  because batch and share are withheld from this host either way. */
const getStanekRam = (
  ns: NS,
  workerRam: number,
  stanekHost: string | null,
  homeReserve: number,
) => {
  if (stanekHost == null) return 0;
  return Math.min(workerRam * STANEK_ALLOTMENT, getChargeCapacity(ns, stanekHost, homeReserve));
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
  const workerRam = getWorkerRam(totalRam, currentServiceRam, homeReserve);
  const allottedShareRam = shouldShare ? workerRam * SHARE_ALLOTMENT : 0;
  const stanekHost = isStanekRunning ? getStanekHost(ns) : null;
  // Clamped, so the three allotments still sum to workerRam and a host too small to
  // hold the full share hands the difference to batch rather than stranding it.
  const allottedStanekRam = getStanekRam(ns, workerRam, stanekHost, homeReserve);
  const allottedBatchRam = workerRam - allottedShareRam - allottedStanekRam;
  const snapshot: RamPolicySnapshot = {
    totalRam,
    homeReserve,
    currentServiceRam,
    allottedShareRam,
    allottedStanekRam,
    allottedBatchRam,
    stanekHost,
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

const workerPrograms = {
  charge: [CHARGE.slice(1)],
  share: [SHARE.slice(1)],
  hack: [HACK, GROW, WEAK].map((s) => s.slice(1)),
} as const;

type WorkerRamState = {
  targetRamUse: number;
  currentWorkers: ProcessInfo[];
  currentRamUse: number;
  currentThreads: number;
  unusedRam: Record<string, number>;
  budgetedRam: Record<string, number>;
  stanekHost: string | null;
};

type WorkerType = keyof typeof workerPrograms;
const getRamState = (ns: NS, workerType: WorkerType): WorkerRamState => {
  const { scriptRam } = getStaticData(ns);
  const snapshot = getRamPolicy(ns);
  const rootHostnames = getHostnames(ns).filter(ns.hasRootAccess);

  if (snapshot == null) {
    return {
      targetRamUse: 0,
      currentWorkers: [],
      currentRamUse: 0,
      currentThreads: 0,
      unusedRam: {},
      budgetedRam: {},
      stanekHost: null,
    };
  }

  const { stanekHost, homeReserve } = snapshot;
  const workerRam = getWorkerRam(snapshot.totalRam, snapshot.currentServiceRam, homeReserve);
  const stanekRam = getStanekRam(ns, workerRam, stanekHost, homeReserve);

  const targetRamUse =
    workerType === 'charge'
      ? stanekRam
      : workerType === 'share'
        ? snapshot.allottedShareRam
        : snapshot.allottedBatchRam;

  // Determine RAM already used by given service type.
  const currentWorkers = rootHostnames.flatMap((hostname) =>
    ns.ps(hostname).filter((ps) => workerPrograms[workerType].includes(ps.filename)),
  );
  const currentRamUse = currentWorkers
    .map((ps) => ps.threads * scriptRam[ps.filename])
    .reduce((a, b) => a + b, 0);
  const currentThreads = currentWorkers.map((ps) => ps.threads).reduce((a, b) => a + b, 0);

  const unusedRam = Object.fromEntries(
    rootHostnames.map((hostname) => {
      const maxRam = ns.getServerMaxRam(hostname);
      const ramUsed = ns.getServerUsedRam(hostname);
      const ramUnused = maxRam - ramUsed;
      const homeReserve = hostname === 'home' ? getHomeReserveRam(ns) : 0;
      const stanekReserve = workerType !== 'charge' && hostname === stanekHost ? stanekRam : 0;
      const ramAvailable = Math.max(0, ramUnused - homeReserve - stanekReserve);
      return [hostname, ramAvailable];
    }),
  );

  // Share of RAM workerType is allowed to draw from.
  // Matches unusedRam when all other workers are at capacity
  const budgetedRam: Record<string, number> = {};
  let unbudgeted = targetRamUse;
  for (const [hostname, ramAvailable] of Object.entries(unusedRam).sort(by(([, ram]) => -ram))) {
    const ramBudgeted = Math.min(ramAvailable, unbudgeted);
    if (ramBudgeted <= 0) break;
    budgetedRam[hostname] = ramBudgeted;
    unbudgeted -= ramBudgeted;
  }

  return {
    targetRamUse,
    currentWorkers,
    currentRamUse,
    currentThreads,
    unusedRam,
    budgetedRam,
    stanekHost,
  };
};

export const getBatchRamState = (ns: NS) => getRamState(ns, 'hack');

export const getWorkerRamState = (ns: NS, workerType: 'charge' | 'share') => {
  const state = getRamState(ns, workerType);
  const workerProgram = workerPrograms[workerType][0];
  const ramPerThread = getStaticData(ns).scriptRam[workerProgram];
  const targetThreads = Math.floor(state.targetRamUse / ramPerThread);
  return { ...state, targetThreads };
};

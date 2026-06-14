import { THREADPOOL } from '../etc/config';
import { HACK, GROW, WEAKEN, SHARE } from '../etc/filenames';
import { by } from './util';
import { getHostnames } from './data-store';

const WORKERS = new Set([HACK, GROW, WEAKEN, SHARE]);

export type ExecProcess = { script: string; highPriority?: boolean };

export type RamPolicy = {
  /** Returns GB to reserve on home for the given process. */
  homeReserve: (process: ExecProcess) => number;
};

export const DEFAULT_POLICY: RamPolicy = {
  homeReserve: ({ script, highPriority }) => {
    if (script === '/bin/access.ts' || script === '/bin/nerd.ts') return 0;
    return highPriority ? 2 : 16;
  },
};

export const getRamInfo = (
  ns: NS,
  hostname: string,
  policy: RamPolicy = DEFAULT_POLICY,
) => {
  const maxRam = ns.getServerMaxRam(hostname);
  const ramUsed = ns.getServerUsedRam(hostname);
  const ramUnused = maxRam - ramUsed;
  let ramAvailableTo = (_: ExecProcess) => ramUnused;
  if (hostname === 'home') {
    ramAvailableTo = (process) =>
      Math.max(0, ramUnused - policy.homeReserve(process));
  } else if (hostname === 'foodnstuff' || hostname === 'neo-net') {
    // These servers only have worker scripts if explicitly copied there.
    // TODO: remove once all servers receive all .ts files at root time.
    ramAvailableTo = ({ script }) => (WORKERS.has(script) ? 0 : ramUnused);
  }
  return { hostname, maxRam, ramUsed, ramUnused, ramAvailableTo };
};

type RamInfo = ReturnType<typeof getRamInfo>;

export const getRootServers = (
  ns: NS,
  policy: RamPolicy = DEFAULT_POLICY,
): RamInfo[] =>
  getHostnames(ns)
    .filter(ns.hasRootAccess)
    .map((h) => getRamInfo(ns, h, policy))
    .sort(by((s) => -s.ramUnused));

export const getPurchasedServers = (
  ns: NS,
  policy: RamPolicy = DEFAULT_POLICY,
): RamInfo[] =>
  getHostnames(ns)
    .filter((h) => h.startsWith(THREADPOOL))
    .sort()
    .map((h) => getRamInfo(ns, h, policy));

export type ExecResult = {
  pid: number;
  hostname: string | null;
  threads: number;
};

export const execOnBestServer = (
  ns: NS,
  script: string,
  host: string | null,
  numThreads: number,
  highPriority: boolean,
  args: ScriptArg[] = [],
  policy: RamPolicy = DEFAULT_POLICY,
): ExecResult => {
  const process = { script, highPriority };
  const scriptRam = ns.getScriptRam(script, 'home');
  const ramRequired = scriptRam * numThreads;

  if (host != null) {
    const server = getRamInfo(ns, host, policy);
    if (ramRequired <= server.ramAvailableTo(process)) {
      const pid = ns.exec(script, host, numThreads, ...args);
      if (pid !== 0) return { pid, hostname: host, threads: numThreads };
    }
    return { pid: 0, hostname: null, threads: 0 };
  }

  const rootServers = getRootServers(ns, policy);
  const eligible = rootServers.filter(
    (s) => ns.getScriptRam(script, s.hostname) > 0,
  );
  const isValid = (s: RamInfo) => s.ramAvailableTo(process) >= ramRequired;
  const isUsable = (s: RamInfo) => s.ramAvailableTo(process) >= scriptRam;
  const server = eligible.find(isValid) ?? eligible.find(isUsable);

  if (server != null) {
    const maxThreads = Math.floor(server.ramAvailableTo(process) / scriptRam);
    const threads = Math.min(numThreads, maxThreads);
    if (threads > 0) {
      const pid = ns.exec(script, server.hostname, threads, ...args);
      if (pid !== 0) return { pid, hostname: server.hostname, threads };
    }
  }

  return { pid: 0, hostname: null, threads: 0 };
};

/**
 * Returns available RAM per server as a flat record, suitable for
 * buildWorkerThreadAllocator. Respects the unified RAM policy so
 * batch workers (thief, angel) honour the same home reserve and
 * foodnstuff/neo-net exclusion as the planner.
 */
export const getWorkerRam = (
  ns: NS,
  script: string,
  policy: RamPolicy = DEFAULT_POLICY,
): Record<string, number> =>
  getRootServers(ns, policy).reduce<Record<string, number>>((acc, info) => {
    const available = info.ramAvailableTo({ script });
    if (available > 0) acc[info.hostname] = available;
    return acc;
  }, {});

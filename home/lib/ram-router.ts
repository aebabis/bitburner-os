import { by } from './util';
import { getHostnames } from './data-store';

type ExecProcess = { script: string; highPriority?: boolean };

export type RamPolicy = {
  /** Returns GB to reserve on home for the given process. */
  homeReserve: (process: ExecProcess) => number;
  /** Returns GB to deduct from the non-home pool (for service RMI overhead). */
};

/** Policy for batch hacking programs (thief, angel): large home reserve + pool awareness. */
export const HACKER_POLICY = (ns: NS): RamPolicy => ({
  homeReserve: () => 16,
});

const DEFAULT_POLICY: RamPolicy = {
  homeReserve: ({ script, highPriority }) => {
    if (
      script === '/bin/self/love.ts' ||
      script === '/bin/nerd.ts' ||
      script === '/bin/corp/corp.ts'
    )
      return 0;
    return highPriority ? 2 : 4;
  },
};

const getRamInfo = (ns: NS, hostname: string, policy: RamPolicy = DEFAULT_POLICY) => {
  const maxRam = ns.getServerMaxRam(hostname);
  const ramUsed = ns.getServerUsedRam(hostname);
  const ramUnused = maxRam - ramUsed;
  let ramAvailableTo = (_: ExecProcess) => ramUnused;
  if (hostname === 'home') {
    ramAvailableTo = (process) => Math.max(0, ramUnused - policy.homeReserve(process));
  }
  return { hostname, maxRam, ramUsed, ramUnused, ramAvailableTo };
};

type RamInfo = ReturnType<typeof getRamInfo>;

type RamAllowances = {
  serviceRam: number;
  hackingRam: number;
  sharingRam: number;
};

// TODO: sharingRam and hackingRam come from same pool
// (sharingRam + hackingRam) is a guaranteed minimum that
// scales with total.
// Decide whether serviceRam is based on unused ram or *all* ram.
// Both approaches suck.
export const getRamAllowances = (ns: NS): RamAllowances => {
  const rootServers = getRootServers(ns);
  const maxRam = rootServers.map((server) => server.maxRam).reduce((a, b) => a + b, 0);
  return {
    sharingRam: maxRam / 10,
  };
};

const getRootServers = (ns: NS, policy: RamPolicy = DEFAULT_POLICY): RamInfo[] =>
  getHostnames(ns)
    .filter(ns.hasRootAccess)
    .map((h) => getRamInfo(ns, h, policy))
    .sort(by((s) => -s.ramUnused));

export type ExecResult = {
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
  policy: RamPolicy = DEFAULT_POLICY,
  scriptRam = ns.getScriptRam(script, 'home'),
): ExecResult => {
  const process = { script, highPriority };
  const numThreads =
    typeof threadOrOptions === 'number' ? threadOrOptions : (threadOrOptions.threads ?? 1);
  const ramRequired = scriptRam * numThreads;

  if (host != null) {
    const server = getRamInfo(ns, host, policy);
    if (ramRequired <= server.ramAvailableTo(process)) {
      const pid = ns.exec(script, host, threadOrOptions, ...args);
      if (pid !== 0) return { pid, hostname: host, threads: numThreads };
    }
    return { pid: 0, hostname: null, threads: 0 };
  }

  const rootServers = getRootServers(ns, policy);
  const eligible = rootServers.filter((s) => ns.getScriptRam(script, s.hostname) > 0);
  const isValid = (s: RamInfo) => s.ramAvailableTo(process) >= ramRequired;
  const isUsable = (s: RamInfo) => s.ramAvailableTo(process) >= scriptRam;
  const server =
    eligible.filter(isValid).sort(by((s) => s.ramAvailableTo(process)))[0] ??
    eligible.find(isUsable);

  if (server != null) {
    const maxThreads = Math.floor(server.ramAvailableTo(process) / scriptRam);
    const threads = Math.min(numThreads, maxThreads);
    const options = typeof threadOrOptions === 'object' ? { ...threadOrOptions, threads } : threads;
    if (threads > 0) {
      const pid = ns.exec(script, server.hostname, options, ...args);
      if (pid !== 0) return { pid, hostname: server.hostname, threads };
    }
  }

  return { pid: 0, hostname: null, threads: 0 };
};

/**
 * Returns available RAM per server as a flat record, suitable for
 * buildWorkerThreadAllocator. Applies the home reserve from policy and
 * deducts policy.
 * Servers where the script is not installed (getScriptRam returns 0) are
 * excluded via execOnBestServer's own check; no special-casing needed here.
 */
export const getWorkerRam = (
  ns: NS,
  script: string,
  policy: RamPolicy = DEFAULT_POLICY,
): Record<string, number> => {
  const normalScript = script.startsWith('/') ? script : '/' + script;
  const result = getRootServers(ns, policy).reduce<Record<string, number>>((acc, info) => {
    const available = info.ramAvailableTo({ script: normalScript });
    if (available > 0) acc[info.hostname] = available;
    return acc;
  }, {});

  let remaining = 0;
  for (const hostname of Object.keys(result)
    .filter((h) => h !== 'home')
    .sort((a, b) => result[b] - result[a])) {
    if (remaining <= 0) break;
    const reduction = Math.min(result[hostname], remaining);
    result[hostname] -= reduction;
    if (result[hostname] <= 0) delete result[hostname];
    remaining -= reduction;
  }

  return result;
};

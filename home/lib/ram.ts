/**
 * Builds a stateful planner for distributing available RAM
 * between hack threads and weak/grow threads based on their size.
 * @param serverRam - A map of server names to RAM available for worker threads.
 * @returns A stateful function that allocates threads to workers on request.
 */
export const buildWorkerThreadAllocator = (
  serverRam: Record<string, number>,
) => {
  const serverIntRam = Object.fromEntries(
    Object.entries(serverRam).map(([hostname, ram]) => [hostname, ram * 20]),
  );

  const hostnames = Object.keys(serverRam);
  const hackHosts: string[] = [];
  const weakHosts: string[] = [];

  const takeHackHost = () => {
    let host;
    while ((host = hackHosts.shift() || hostnames.shift())) {
      if (serverIntRam[host] >= 34) return host;
    }
  };
  const takeWeakHost = () => {
    let host;
    while ((host = weakHosts.shift() || hostnames.pop())) {
      if (serverIntRam[host] >= 34) {
        if (serverIntRam[host] >= 35) return host;
        else hackHosts.push(host); // Edge case: exactly 1.7GB left
      }
    }
  };

  /**
   * Assigns threads for the given thread size, 1.7 or 1.75.
   * If no server can issue the amount requested, a partial amount
   * may be given. In this case, the function should be called again.
   * @param maxThreads - The maximum number of threads requested.
   * @param size - The thread size of the worker
   * @returns A number in the range (0, maxThreads] if there is a server
   * with room remaining; null otherwise.
   */
  return (maxThreads: number, size: 1.7 | 1.75) => {
    const intSize = size === 1.7 ? 34 : 35;
    const hostname = size === 1.7 ? takeHackHost() : takeWeakHost();
    if (hostname == null) return null;
    const threadsAvailable = packThreads(serverIntRam[hostname], intSize);
    const threadsAllocated = Math.min(maxThreads, threadsAvailable);
    serverIntRam[hostname] -= threadsAllocated * intSize;
    if (serverIntRam[hostname] >= 34) {
      if (threadsAllocated === threadsAvailable) {
        if (size === 1.7) weakHosts.push(hostname);
        else hackHosts.push(hostname);
      } else {
        if (size === 1.7) hostnames.unshift(hostname);
        else hostnames.push(hostname);
      }
    }
    return [hostname, threadsAllocated] as [string, number];
  };
};

/** Gets the maximum amount of worker threads of one type
 *  that can be taken from RAM pool while still allowing
 *  pool to be completely consumed. If no combination of
 *  worker threads will completely consume the pool, returns
 *  the maximum threads that will fit instead.
 *  @param intRam - Available ram, scaled by 20 to avoid numeric issues.
 *  @param intSize - The size of the worker thread, scaled by 20 to avoid numeric issues.
 *  @returns Maximum number of threads that workers of the provided type
 *  are allowed to take
 */
const packThreads = (intRam: number, intSize: 34 | 35) => {
  const intOther = 34 + 35 - intSize;
  const M = Math.floor(intRam / intSize);
  const r =
    intSize === 34
      ? ((-intRam % intOther) + intOther) % intOther
      : intRam % intOther;
  const threads = r + intOther * Math.floor((M - r) / intOther);
  if (threads < 0) {
    return Math.floor(intRam / intSize);
  } else {
    return threads;
  }
};

const test = (ns: NS, ram: number, type: 'HACK' | 'WEAKEN' | 'GROW') => {
  if (type === 'HACK') {
    const h = packThreads(ram * 20, 34);
    const w = (ram - h * 1.7) / 1.75;
    ns.tprint(`${h} * 1.75 + ${w} * 1.7 = ${h * 1.7 + w * 1.75}`);
  } else {
    const w = packThreads(ram * 20, 35);
    const h = (ram - w * 1.75) / 1.7;
    ns.tprint(`${h} * 1.75 + ${w} * 1.7 = ${h * 1.7 + w * 1.75}`);
  }
};

export async function main(ns: NS) {
  test(ns, 1000, 'HACK');
  test(ns, 1000, 'WEAKEN');
  test(ns, ns.cloud.getRamLimit(), 'HACK');
  test(ns, ns.cloud.getRamLimit(), 'WEAKEN');
}

/**
 * Builds a stateful planner for distributing available RAM
 * between hack threads and weak/grow threads based on their size.
 * @param serverRam - A map of server names to RAM available for worker threads.
 * @returns A stateful function that allocates threads to workers on request.
 */
export const buildWorkerThreadAllocator = (
  serverRam: Record<string, number>,
) => {
  // Multiply each ram value by 20
  // so allocation can use integer math.
  const serverIntRam = Object.fromEntries(
    Object.entries(serverRam).map(([hostname, ram]) => [
      hostname,
      Math.floor(ram * 20),
    ]),
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
  const allocator = (maxThreads: number, size: 1.7 | 1.75) => {
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
        // If server can still assign both types of threads,
        // return it to the hostnames list. Put hacking thread
        // servers at the front and weak/grow at the back to ensure
        // servers are finished before moving to the next.
        if (size === 1.7) hostnames.unshift(hostname);
        else hostnames.push(hostname);
      }
    }
    if (threadsAllocated === 0) {
      // This is uncommon and will only happen if availableThreads
      // is 0 the first time a server is examined. In this case,
      // run the algorithm again to guarantee number is strictly > 0
      return allocator(maxThreads, size);
    }
    return [hostname, threadsAllocated] as [string, number];
  };
  return allocator;
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

const test = (ram: number, type: 'HACK' | 'WEAKEN' | 'GROW') => {
  const RED = `\u001b[38;5;1m`;
  const GREEN = `\u001b[38;5;28m`;
  const RESET = '\u001b[0m';

  const color = (pass: boolean) => (pass ? GREEN : RED);

  let h: number;
  let w: number;

  if (type === 'HACK') {
    h = packThreads(ram * 20, 34);
    w = Math.floor((ram - h * 1.7) / 1.75);
  } else {
    w = packThreads(ram * 20, 35);
    h = Math.floor((ram - w * 1.75) / 1.7);
  }
  const total = h * 1.7 + w * 1.75;
  const pass = total === ram;
  const lhs = `${h} * 1.7 + ${w} * 1.75`.padEnd(27);
  return `${color(pass)}${ram.toString().padStart(10)}  ${lhs} = ${total.toString().padStart(10)}${RESET}`;
};

export async function main(ns: NS) {
  const results = [] as string[];
  for (let p = 2; p <= 30; p++) {
    results.push(test(2 ** p, 'HACK'));
    results.push(test(2 ** p, 'WEAKEN'));
  }
  const n = (num: number) => num.toString().padEnd(2);
  ns.tprint(
    '\n' + results.map((result, i) => `${n(i + 1)}  ${result}`).join('\n'),
  );
}

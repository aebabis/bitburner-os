import { nmap } from './lib/nmap';
import { tprint } from './boot/util';
import { GRAY, STR } from './lib/colors';
import { getServices } from './lib/service-api';

export const stop = async (ns: NS) => {
  // Since batching can create several 1000 threads, this routine
  // may lock up if it doesn't yield. But yielding can give other
  // scripts a chance to spawn more processes.
  // Since preventing lag is the priority, we iteratively kill
  // processes until we can kill all remaining processes without
  // needing to yield the thread.

  tprint(ns)(STR.BOLD + 'SHUTTING DOWN');

  // Close service tails to prevent clutter
  const services = getServices(ns);
  if (services) {
    for (const service of services) {
      if (service.pid != null) ns.ui.closeTail(service.pid);
    }
  }

  const hostnames = nmap(ns);

  let lastRested = Date.now();
  let killedAny = false;
  do {
    killedAny = false;
    for (const hostname of hostnames) {
      const hadProcesses = ns.killall(hostname, true);
      killedAny = killedAny || hadProcesses;
      if (hadProcesses) tprint(ns)(GRAY + `  killall on ${hostname}`);

      // Prevent infinite loop by making kills a requirement for sleep
      if (killedAny) {
        const timeSinceSleep = Date.now() - lastRested;
        if (timeSinceSleep > 200) {
          tprint(ns)(GRAY + `  Yielding (${timeSinceSleep}ms since last sleep)`);
          await ns.sleep(1);
          lastRested = Date.now();
        }
      }
    }
  } while (killedAny);
  tprint(ns)(STR + '  Shutdown complete');
};

export async function main(ns: NS) {
  await ns.sleep(100);
  await stop(ns);
  const [script, numThreads, ...args] = ns.args;
  if (ns.args.length > 0) {
    tprint(ns)(GRAY + `  Executing callback: ${script} ${args.join(' ')}`);
    ns.run(script as string, numThreads as number, ...args);
  }
}

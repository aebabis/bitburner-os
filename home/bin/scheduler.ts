import { THREADPOOL } from '../etc/config';
import { by } from '../lib/util';
import {
  checkPort,
  fulfill,
  reject,
  lastRuns,
  lastCancellations,
  droppedTickets,
  TicketEntry,
  ServerRamInfo,
} from '../lib/scheduler-api';
import {
  getStaticData,
  putRamData,
  getHostnames,
  putSchedulerReportData,
} from '../lib/data-store';
import { PORT_SCH_DELEGATE_TASK, PORT_SCH_RETURN } from '../etc/ports';
import { logger } from '../lib/logger';

const SCHEDULER_HOME = 'home';

export async function main(ns: NS) {
  ns.disableLog('ALL');

  if (ns.getHostname() !== SCHEDULER_HOME) {
    throw new Error(`Scheduler only runs on ${SCHEDULER_HOME}`);
  }

  // Scheduler completes the bootstrap process
  // by starting the planner. This is done since
  // it can't run on 8GB ram while the boot
  // sequence is finishing.
  await ns.sleep(50);
  ns.exec('/bin/planner.ts', 'home');

  const { purchasedServerMaxRam, purchasedServerLimit } = getStaticData(ns);

  const getRamInfo = (hostname: string): ServerRamInfo => {
    const maxRam = ns.getServerMaxRam(hostname);
    const ramUsed = ns.getServerUsedRam(hostname);
    const ramUnused = maxRam - ramUsed;
    let ramAvailableTo = (_process: {
      script: string;
      highPriority?: boolean;
      isWorker: boolean;
    }) => ramUnused;
    if (hostname === 'home') {
      // On home, 32GB is unavailable to services
      // and batch jobs so that rmi calls can use it.
      // The last 2GB is always reserved for manual (user)
      // programs.
      const reserve = (gb: number) => Math.max(0, ramUnused - gb);
      ramAvailableTo = (process) => {
        if (process.script === '/bin/access.ts') return reserve(0);
        if (process.highPriority) return reserve(2);
        return reserve(32);
      };
    } else if (['foodnstuff', 'neo-net'].includes(hostname)) {
      ramAvailableTo = (process) => (process.isWorker ? 0 : ramUnused);
    }
    return {
      hostname,
      maxRam,
      ramUsed,
      ramUnused,
      ramAvailableTo,
    };
  };

  const getRamData = (ns: NS) => {
    const hostnames = getHostnames(ns);
    const rootServers = hostnames
      .filter(ns.hasRootAccess)
      .map(getRamInfo) //.filter(server=>server.hasAdminRights)
      .sort(by((s) => -s.ramUnused));
    const purchasedServers = hostnames
      .filter((hostname) => hostname.startsWith(THREADPOOL))
      .sort()
      .map(getRamInfo);
    const purchasedServersMaxedOut =
      purchasedServers.length === purchasedServerLimit &&
      purchasedServers.every(
        (server) => server.maxRam === purchasedServerMaxRam,
      );
    const totalMaxRam =
      rootServers.map((s) => s.maxRam).reduce((a, b) => a + b, 0) || 0;
    const totalRamUsed =
      rootServers.map((s) => s.ramUsed).reduce((a, b) => a + b, 0) || 0;
    const totalRamUnused = totalMaxRam - totalRamUsed;
    const maxRamSlot = rootServers
      .map((s) => s.maxRam - s.ramUsed)
      .reduce((a, b) => (a > b ? a : b), 0);
    const demand = queue
      .map(
        ({ script, numThreads }) =>
          numThreads * ns.getScriptRam(script, 'home'),
      )
      .reduce((a, b) => a + b, 0);
    const data = {
      rootServers,
      purchasedServers,
      purchasedServerMaxRam,
      purchasedServersMaxedOut,
      purchasedServerLimit,
      totalRamUsed,
      totalRamUnused,
      totalMaxRam,
      maxRamSlot,
      demand,
    };
    return data;
  };

  const queue: TicketEntry[] = [];
  while (true) {
    try {
      ns.clearLog();
      const { length } = queue;
      await checkPort(ns, queue);
      if (queue.length === 0) {
        await ns.sleep(20);
        continue;
      } else if (queue.length !== length)
        queue.sort(by((job) => job.startTime ?? 0));

      const now = Date.now();
      for (let i = 0; i < queue.length; i++) {
        const process = queue[i];
        if ((process.startTime ?? 0) > now) break;
        const waitTime = process.waitTime();
        if (waitTime > 50 && process.isWorker) {
          globalThis.__profiler?.recordReaped?.(process.args[1]);
          queue.splice(i--, 1);
          continue;
        } else if (waitTime > 60000) {
          await reject(ns, queue.splice(i--, 1)[0]);
          continue;
        }
        const scriptRam = ns.getScriptRam(process.script, 'home');
        const ramRequired = scriptRam * process.numThreads;

        const ramQueued = queue
          .map(({ script, numThreads }) => ns.getScriptRam(script) * numThreads)
          .reduce((a, b) => a + b, 0);
        const ramData = getRamData(ns);
        putRamData(ns, { ...ramData, ramQueued });

        if (process.host != null) {
          // Specific server requested
          const server = getRamInfo(process.host);
          if (ramRequired <= server.ramAvailableTo(process)) {
            await fulfill(ns, queue.splice(i--, 1)[0], server);
            continue;
          }
        } else {
          // No preference; choose
          const eligibleServers = ramData.rootServers.filter(
            (server) => ns.getScriptRam(process.script, server.hostname) > 0,
          );

          const isServerValid = (server: ReturnType<typeof getRamInfo>) =>
            server?.ramAvailableTo(process) >= ramRequired;
          const isServerUsable = (server: ReturnType<typeof getRamInfo>) =>
            server?.ramAvailableTo(process) >= scriptRam;

          const server = eligibleServers.find(isServerValid);
          const settleServer = eligibleServers.find(isServerUsable);

          if (server != null)
            await fulfill(ns, queue.splice(i--, 1)[0], server);
          else if (settleServer != null)
            await fulfill(ns, queue.splice(i--, 1)[0], settleServer);
          else if (
            !process.isWorker &&
            ramRequired <= ns.getServerMaxRam('home')
          )
            logger(ns).warn('Failed to find RAM for: ' + process.toString());
        }
      }
      ns.print(`${queue.length} items queued`);
      queue.forEach((item) => ns.print(item.toString()));
    } catch (error) {
      if (
        error != null &&
        typeof error === 'object' &&
        'name' in error &&
        error?.name === 'ScriptDeath'
      )
        throw error;
      logger(ns).error(error);
    } finally {
      putSchedulerReportData(ns, {
        lastRuns,
        lastCancellations,
        heartbeat: Date.now(),
        inputFull: ns.getPortHandle(PORT_SCH_DELEGATE_TASK).full(),
        outputFull: ns.getPortHandle(PORT_SCH_RETURN).full(),
        maxWaitTime: queue.reduce(
          (max, item) => Math.max(max, item.waitTime()),
          0,
        ),
        droppedTickets,
      });
      await ns.sleep(10);
    }
  }
}

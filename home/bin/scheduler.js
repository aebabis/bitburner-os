import { THREADPOOL } from "../etc/config";
import { by } from "../lib/util";
import { checkPort, fulfill, reject } from "../lib/scheduler-api";
import { getStaticData, putRamData, getHostnames } from "../lib/data-store";
import { logger } from "../lib/logger";

const SCHEDULER_HOME = "home";

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");

  if (ns.getHostname() !== SCHEDULER_HOME) {
    throw new Error(`Scheduler only runs on ${SCHEDULER_HOME}`);
  }

  // Scheduler completes the bootstrap process
  // by starting the planner. This is done since
  // it can't run on 8GB ram while the boot
  // sequence is finishing.
  await ns.sleep(50);
  ns.exec("/bin/planner.js", "home");

  const { purchasedServerMaxRam, purchasedServerLimit } = getStaticData(ns);

  /** @param {string} hostname */
  const getRamInfo = (hostname) => {
    const maxRam = ns.getServerMaxRam(hostname);
    const ramUsed = ns.getServerUsedRam(hostname);
    const ramUnused = maxRam - ramUsed;
    let ramAvailableTo = (/** @type {{script: string, highPriority?: boolean, isWorker: boolean}} */ _process) => ramUnused;
    if (hostname === "home") {
      // On home, 32GB is unavailable to services
      // and batch jobs so that rmi calls can use it.
      // The last 2GB is always reserved for manual (user)
      // programs.
      const reserve = (/** @type {number} */ gb) => Math.max(0, ramUnused - gb);
      ramAvailableTo = (process) => {
        if (process.script === "/bin/access.js") return reserve(0);
        if (process.highPriority) return reserve(2);
        return reserve(32);
      };
    } else if (["foodnstuff", "neo-net"].includes(hostname)) {
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

  /** @param {NS} ns **/
  const getRamData = (ns) => {
    const hostnames = getHostnames(ns);
    const rootServers = hostnames
      .filter(ns.hasRootAccess)
      .map(getRamInfo) //.filter(server=>server.hasAdminRights)
      .sort(by((/** @type {ReturnType<typeof getRamInfo>} */ s) => -s.ramUnused));
    const purchasedServers = hostnames
      .filter((/** @type {string} */ hostname) => hostname.startsWith(THREADPOOL))
      .sort()
      .map(getRamInfo);
    const purchasedServersMaxedOut =
      purchasedServers.length === purchasedServerLimit &&
      purchasedServers.every(
        (/** @type {ReturnType<typeof getRamInfo>} */ server) => server.maxRam === purchasedServerMaxRam,
      );
    const totalMaxRam =
      rootServers.map((/** @type {ReturnType<typeof getRamInfo>} */ s) => s.maxRam).reduce((/** @type {number} */ a, /** @type {number} */ b) => a + b, 0) || 0;
    const totalRamUsed =
      rootServers.map((/** @type {ReturnType<typeof getRamInfo>} */ s) => s.ramUsed).reduce((/** @type {number} */ a, /** @type {number} */ b) => a + b, 0) || 0;
    const totalRamUnused = totalMaxRam - totalRamUsed;
    const maxRamSlot = rootServers
      .map((/** @type {ReturnType<typeof getRamInfo>} */ s) => s.maxRam - s.ramUsed)
      .reduce((/** @type {number} */ a, /** @type {number} */ b) => (a > b ? a : b), 0);
    const demand = queue
      .map(
        ({ script, numThreads }) =>
          numThreads * ns.getScriptRam(script, "home"),
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
    // ns.tprint(JSON.stringify(purchasedServers, null, 2));
    return data;
  };

  const queue = /** @type {{script: string, numThreads: number, startTime: number, time: number, isWorker: boolean, args: string[], host: string | null, waitTime: () => number, toString: (hostname?: string) => string, highPriority: boolean, ticket?: string}[]} */ ([]);
  while (true) {
    try {
      ns.clearLog();
      // clean(ns);
      const { length } = queue;
      await checkPort(ns, queue);
      if (queue.length === 0) {
        await ns.sleep(20);
        continue;
      } else if (queue.length !== length)
        queue.sort(by((/** @type {{startTime: number}} */ job) => job.startTime));

      const now = Date.now();
      for (let i = 0; i < queue.length; i++) {
        const process = queue[i];
        if (process.startTime > now) break;
        const waitTime = process.waitTime();
        if (waitTime > 50 && process.isWorker) {
          globalThis.__profiler?.recordReaped?.(process.args[1]);
          queue.splice(i--, 1);
          continue;
        } else if (waitTime > 60000) {
          await reject(ns, queue.splice(i--, 1)[0]);
          continue;
        }
        const scriptRam = ns.getScriptRam(process.script, "home");
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

          const isServerValid = (/** @type {ReturnType<typeof getRamInfo>} */ server) =>
            server?.ramAvailableTo(process) >= ramRequired;

          const server = eligibleServers.find(isServerValid);
          const settleServer = eligibleServers[0];

          if (server != null) await fulfill(ns, queue.splice(i--, 1)[0], server);
          else if (settleServer?.ramAvailableTo(process) >= scriptRam)
            await fulfill(ns, queue.splice(i--, 1)[0], settleServer);
          else if (
            !process.isWorker &&
            ramRequired <= ns.getServerMaxRam("home")
          )
            logger(ns).warn("Failed to find RAM for: " + process.toString());
        }
      }
      ns.print(`${queue.length} items queued`);
      queue.forEach((item) => ns.print(item.toString()));
    } catch (error) {
      if (error?.name === 'ScriptDeath') throw error;
      logger(ns).error(error);
    } finally {
      await ns.sleep(10);
    }
  }
}

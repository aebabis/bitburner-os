import { THREADPOOL } from "../etc/config";
import { logger } from "../lib/logger";
import { by } from "../lib/util";
import { table } from "../lib/table";
import { getHostnames, getRamData, getMoneyData, putMoneyData } from "../lib/data-store";

import Thief, { HORIZON_MS } from "../lib/thief";
import { initProfiler } from "../lib/profiler";

/** @typedef {{hostname: string, type?: string, jobs?: number, portion?: number, timeLeft?: string, frame?: string}} ThiefTableRow */

/** @param {NS} ns **/
export async function main(ns) {
  initProfiler();
  ns.disableLog("ALL");

  ns.ui.openTail();

  const feed = /** @type {string[]} */ ([]);
  const log = (/** @type {string} */ message) => {
    feed.push(message);
    while (feed.length > 10) feed.shift();
  };

  const hostnames = getHostnames(ns);
  const possibleTargets = hostnames.filter(
    (/** @type {string} */ hostname) =>
      hostname !== "home" &&
      !hostname.startsWith(THREADPOOL) &&
      ns.getServerMaxMoney(hostname) > 0,
  );

  const thieves = possibleTargets.map((/** @type {string} */ hostname) => new Thief(ns, hostname));

  const prioritize = (/** @type {number} */ ram) =>
    thieves
      .filter((/** @type {Thief} */ thief) => thief.canHack())
      .sort(by((/** @type {Thief} */ thief) => -thief.getDesirability(HORIZON_MS, ram)));

  let viableThieves = /** @type {Thief[]} */ ([]);
  let lastPrioritization = 0;

  while (true) {
    try {
      const ramData = getRamData(ns);
      if (ramData == null) continue;

      if (Date.now() - lastPrioritization > 10000) {
        viableThieves = prioritize(ramData.totalMaxRam);
        lastPrioritization = Date.now();
      }

      const reservedThreads = viableThieves
        .map((/** @type {Thief} */ thief) => thief.getReservedThreads())
        .reduce((/** @type {number} */ a, /** @type {number} */ b) => a + b, 0);

      let ramAvailable = ramData.totalRamUnused - reservedThreads * 1.75;

      // God mode: when one hack thread can steal 50%+ of the best server,
      // batches are trivially cheap and spreading across all servers is better.
      const [topThief] = viableThieves;
      const godMode =
        topThief != null && ns.hackAnalyze(topThief.getHostname()) >= 0.5;

      ns.clearLog();
      const secStr = (/** @type {string} */ hostname) =>
        `${+ns.getServerSecurityLevel(hostname).toFixed(1)}/${ns.getServerMinSecurityLevel(hostname)}`;
      const moneyStr = (/** @type {string} */ hostname) =>
        `${ns.formatNumber(ns.getServerMoneyAvailable(hostname), 2)}/${ns.formatNumber(ns.getServerMaxMoney(hostname), 2)}`;
      const rows = viableThieves
        .filter(
          (/** @type {Thief} */ thief) =>
            thief.currentBatch != null && !thief.currentBatch.hasEnded(),
        )
        .flatMap((/** @type {Thief} */ thief) => thief.getTableData())
        .map((/** @type {ThiefTableRow} */ { hostname, type, frame, portion, jobs, timeLeft }) => {
          return [
            hostname,
            moneyStr(hostname),
            secStr(hostname),
            type,
            frame,
            portion,
            jobs,
            timeLeft,
          ];
        })
        .sort(by(0));
      const tString = table(
        ns,
        ["SERVER", "MONEY", "SEC", "TYPE", "FRAME", "PORTION", "JOBS", "TIME"],
        rows,
      );
      ns.print(tString);
      ns.print(
        ` RAM AVAILABLE: ${ramAvailable.toFixed(2)}  MODE: ${godMode ? "GOD" : "FOCUS"}`,
      );

      const stealing = viableThieves.filter((/** @type {Thief} */ thief) => thief.isStealing());
      const grooming = viableThieves.filter((/** @type {Thief} */ thief) => thief.isGrooming());
      const mayGroom = grooming.length <= stealing.length;
      const mayStart = (/** @type {Thief} */ thief) =>
        thief.canStartNextBatch() && (thief.isGroomed() || thief.isPipelining() || mayGroom);

      const startable = viableThieves.filter(mayStart);
      const candidates = godMode
        ? startable
        : mayStart(topThief)
          ? [topThief]
          : [];
      const ramBudget = godMode
        ? (ramAvailable / Math.max(candidates.length, 1)) * 0.9
        : ramAvailable * 0.9;

      const weakenTimes = candidates
        .filter((thief) => thief.isPipelining())
        .map((thief) => thief.getWeakenTime() / 1000);
      if (weakenTimes.length > 0) {
        const thiefReferenceWindow = 2 * Math.max(...weakenTimes);
        const moneyData = getMoneyData(ns);
        putMoneyData(ns, {
          ...moneyData,
          thiefReferenceWindow,
        });
      }

      for (const thief of candidates) {
        if (ramAvailable <= 0) break;
        const outcome = await thief.startNextBatch(
          ramBudget,
          ramData.maxRamSlot / 2,
        );
        if (outcome) {
          log(`Started batch on ${thief.getHostname()}`);
          ramAvailable -= thief.getReservedThreads() * 1.75;
        }
      }
    } catch (error) {
      console.error(error);
      await logger(ns).error(error);
    } finally {
      await ns.sleep(5);
    }
  }
}

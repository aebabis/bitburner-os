import { HORIZON_MS, THREADPOOL } from '../etc/config';
import { logger } from '../lib/logger';
import { by } from '../lib/util';
import { table } from '../lib/table';
import {
  getHostnames,
  getRamData,
  getMoneyData,
  putMoneyData,
} from '../lib/data-store';

import Thief from '../lib/thief';
import { initProfiler } from '../lib/profiler';

type ThiefTableRow = {
  hostname: string;
  type?: string;
  jobs?: number;
  portion?: number;
  timeLeft?: string;
  frame?: string;
};

export async function main(ns: NS) {
  initProfiler();
  ns.disableLog('ALL');

  const WIDTH = 800;
  const HEIGHT = 150;
  const x = eval('doc' + 'ument.body').clientWidth - WIDTH;
  const y = eval('doc' + 'ument.body').clientHeight - HEIGHT;
  ns.ui.openTail();
  ns.ui.resizeTail(WIDTH, HEIGHT);
  ns.ui.moveTail(x - 2, y - 30);

  const feed: string[] = [];
  const log = (message: string) => {
    feed.push(message);
    while (feed.length > 10) feed.shift();
  };

  const hostnames = getHostnames(ns);
  const possibleTargets = hostnames.filter(
    (hostname: string) =>
      hostname !== 'home' &&
      !hostname.startsWith(THREADPOOL) &&
      ns.getServerMaxMoney(hostname) > 0,
  );

  const thieves = possibleTargets.map(
    (hostname: string) => new Thief(ns, hostname),
  );

  const prioritize = (ram: number) =>
    thieves
      .filter((thief) => thief.canHack())
      .sort(by((thief) => -thief.getDesirability(HORIZON_MS, ram)));

  let viableThieves: Thief[] = [];
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
        .map((thief) => thief.getReservedThreads())
        .reduce((a, b) => a + b, 0);

      // let ramAvailable = ramData.totalRamUnused - reservedThreads * 1.75;
      let ramAvailable =
        (ramData.rootServers ?? [])
          .map((server) => server.ramUnused)
          .filter((ram) => ram >= 1.75)
          .reduce((a, b) => a + b, 0) - reservedThreads;

      // God mode: when one hack thread can steal 50%+ of the best server,
      // batches are trivially cheap and spreading across all servers is better.
      const [topThief] = viableThieves;
      const godMode =
        topThief != null && ns.hackAnalyze(topThief.getHostname()) >= 0.5;

      ns.clearLog();
      const secStr = (hostname: string) =>
        `${+ns.getServerSecurityLevel(hostname).toFixed(1)}/${ns.getServerMinSecurityLevel(hostname)}`;
      const moneyStr = (hostname: string) =>
        `${ns.format.number(ns.getServerMoneyAvailable(hostname), 2)}/${ns.format.number(ns.getServerMaxMoney(hostname), 2)}`;
      const rows = viableThieves
        .filter(
          (thief) =>
            thief.currentBatch != null && !thief.currentBatch.hasEnded(),
        )
        .flatMap((thief) => thief.getTableData())
        .map(({ hostname, type, frame, portion, jobs, timeLeft }) => {
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
        ['SERVER', 'MONEY', 'SEC', 'TYPE', 'FRAME', 'PORTION', 'JOBS', 'TIME'],
        rows,
      );
      ns.print(tString);
      ns.print(
        ` RAM AVAILABLE: ${ramAvailable.toFixed(2)}  MODE: ${godMode ? 'GOD' : 'FOCUS'}`,
      );

      const stealing = viableThieves.filter((thief) => thief.isStealing());
      const grooming = viableThieves.filter((thief) => thief.isGrooming());
      const mayGroom = grooming.length <= stealing.length;
      const mayStart = (thief: Thief) =>
        thief.canStartNextBatch() &&
        (thief.isGroomed() || thief.isPipelining() || mayGroom);

      const startable = viableThieves.filter(mayStart);
      const candidates = godMode
        ? startable
        : mayStart(topThief)
          ? [topThief]
          : [];
      const ramBudget = godMode
        ? (ramAvailable / Math.max(candidates.length, 1)) * 0.9
        : ramAvailable * 0.9;

      const thiefReferenceTimes = viableThieves
        .filter((thief) => thief.isPipelining())
        .map(
          (thief) =>
            Math.max(4 * thief.getWeakenTime(), thief.getBatchDuration()) /
            1000,
        );
      if (thiefReferenceTimes.length > 0) {
        const thiefReferenceWindow = Math.max(...thiefReferenceTimes);
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

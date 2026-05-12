import { THREADPOOL } from "../etc/config";
import { getPath } from "../lib/backdoor.js";
import { getStaticData, getMoneyData, getPlayerData, getGoalsData } from "../lib/data-store";
import { getGoals } from "../lib/goals";
import { GrowingWindow, renderWindows } from "../lib/layout";
import { getTailModal, getModalColumnCount } from "../lib/modal";
import { table } from "../lib/table";
import { getServices } from "../lib/service-api";
import { C, MEDIUM, BRIGHT } from "../lib/colors";
import {
  getTimeEstimates,
  getGoalCost,
  hasBitNode,
} from "../lib/query-service";

const H = BRIGHT.BOLD;

/** @param {number} seconds */
const formatTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  /** @param {number} n */
  const pad = (n) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

/** @param {NS} ns */
const getRunStats = (ns) => {
  const { city, hp, numPeopleKilled, money } = ns.getPlayer();
  const { onlineRunningTime = 0 } = ns.getRunningScript("/bin/scheduler.js", "home") || {};
  const { estimatedStockValue = 0 } = getMoneyData(ns);

  const karma = Math.trunc(ns.heart.break());
  const BN = `BN${ns.getResetInfo().currentNode}`;
  const time = formatTime(onlineRunningTime);
  const stock = ns.formatNumber(estimatedStockValue, 1);
  return [
    ' ' + H(BN),
    H('UP') + ' ' + time,
    H('CITY') + ' ' + city,
    H('HP') + ' ' + C(170)(`${hp.current}/${hp.max}`),
    H('CASH') + C(217)(` $${ns.formatNumber(money, 1)}`),
    H('PORTFOLIO') + C(217)(` $${stock}`),
    H('KILLS') + ' ' + numPeopleKilled,
    H('KARMA') + ' ' + karma,
    getWork(ns),
  ].join('  ');
};

/** @param {NS} ns */
const getPlayerLevels = (ns) => {
  const WIDTH = 10;
  const { skills } = ns.getPlayer();
  const row = (/** @type {string} */ left, /** @type {number} */ c2, /** @type {number} */ right) => {
    const val = right;
    const padding = WIDTH - left.length - val.toString().length;
    return ` ${H(left)}${' '.repeat(padding)}${C(c2)(val)} `;
  }
  return [
    row('Hack', 72, skills.hacking),
    row('Str', 251, skills.strength),
    row('Def', 251, skills.defense),
    row('Dex', 251, skills.dexterity),
    row('Agi', 251, skills.agility),
    row('Cha', 251, skills.charisma),
  ].join('\n');
};

const backdoorPath = (/** @type {NS} */ ns) => {
  const SPACES = " ".repeat(" connect powerhouse-fitness ".length) + "\n";
  const HEAD = ` ${BRIGHT.BOLD("BACKDOOR HELPER")} \n`;
  const path = getPath(ns);
  if (path == null) {
    return HEAD + " (no available servers) " + SPACES.repeat(2) + "\n\n\n\n";
  } else {
    const rows = [
      ...path.map((/** @type {string} */ s) => (s === "home" ? " home" : ` connect ${s} `)),
      " backdoor",
    ];
    if (rows.length >= 6) {
      rows.length = 5;
      rows.push(" ...");
    } else {
      for (let i = 0; i < rows.length - 6; i++) rows.push(" ");
    }
    return HEAD + rows.join("\n");
  }
};

/** @param {NS} ns
 *  @param {Server} server
 */
const threadpoolRow = (ns, server) => {
  const { hostname, ramUsed, maxRam } = server;
  const n = hostname.split("-")[1] || "?";
  const ram = `${ns.formatRam(ramUsed, 0).padStart(5)}/${ns.formatRam(maxRam, 0).padEnd(5)}`;
  return [n, ram];
};

/** @param {NS} ns **/
const threadpools = (ns) => {
  const names = Array(ns.getPurchasedServerLimit())
    .fill(null)
    .map((_, i) => (i + 1).toString().padStart(2, "0"))
    .map((num) => `${THREADPOOL}-${num}`);
  return names
    .map((hostname) => {
      try {
        return {
          hostname,
          ramUsed: ns.getServerUsedRam(hostname),
          maxRam: ns.getServerMaxRam(hostname),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .map((server) => threadpoolRow(ns, server));
};

/** @param {NS} ns */
const threadpoolTable = (ns) => {
  const { purchasedServerLimit } = getStaticData(ns);
  const third = Math.ceil(purchasedServerLimit / 3);
  const data = threadpools(ns);
  const left = data.slice(0, third);
  const middle = data.slice(third, third * 2);
  const right = data.slice(third * 2);
  const rows = left.map((list, i) => [...list, ...(middle[i] || ["", ""]), ...(right[i] || ["", ""])]);
  return BRIGHT.BOLD(" SERVERS ") + "\n" + table(ns, null, rows);
};


const goalsTable = (/** @type {NS} */ ns) => {
  const { enabled = true } = getGoalsData(ns);
  if (!enabled) return ` ${H("GOALS")} \n ${MEDIUM("(disabled)")} `;
  const goals = getGoals(ns);
  return table(
    ns,
    ["GOALS"],
    goals.map(goal => [goal.toString()]),
    { colors: true },
  );
};

const moneyTable = (/** @type {NS} */ ns) => {
  const moneyData = getMoneyData(ns);
  if (moneyData == null) {
    return ` ${H("INCOME")} \n ${MEDIUM(loading)} `;
  }
  const { moneyTime, repTime } = getTimeEstimates(ns) || 0;
  const goalCost = getGoalCost(ns);
  const {
    theftIncome = 0,
    thiefReferenceWindow = 0,
    hacknetIncome = 0,
    gangIncome = 0,
    referenceIncome = 0,
  } = moneyData;
  const rows = [
    ["Theft", `$${ns.formatNumber(theftIncome, 1)}/s`],
    ['', formatTime(thiefReferenceWindow)],
    ["Hacknet", `$${ns.formatNumber(hacknetIncome, 1)}/s`],
    ["Gang", `$${ns.formatNumber(gangIncome, 1)}/s`],
    ["Total", `$${ns.formatNumber(referenceIncome, 1)}/s`],
    ['', ''],
    ["Goal", ("$" + ns.formatNumber(goalCost || 0, 1)).padStart(8)],
    ["   $", formatTime(moneyTime != null ? moneyTime : 100 * 60 * 60).padStart(8)],
    ["   r", formatTime(repTime || 100 * 60 * 60).padStart(8)],
  ];
  return ` ${H("INCOME")} \n` + table(ns, null, rows);
};

/** @param {NS} ns */
const getWork = (ns) => {
  const { factionRep = {}, currentWork } = getPlayerData(ns);
  const { location } = ns.getPlayer();
  const WORK = H("WORK");
  if (!hasBitNode(ns, 4)) return ` ${WORK} ${MEDIUM('(unknown)')} `;
  if (currentWork == null) return ` ${WORK} ${MEDIUM("(idle)")} `;
  const {
    type,
    crimeType,
    companyName,
    factionName,
    // workMoneyGained,
    // workRepGained,
  } = currentWork;
  if (type === "FACTION") {
    const rep = Math.floor(factionRep[factionName]);
    return ` ${WORK} ${factionName} ${MEDIUM(`(${rep} rep)`)} `;
  } else if (type === "COMPANY") {
    return ` ${WORK} ${companyName} `;
  } else if (type === "CRIME") {
    return ` ${WORK} ${crimeType} `;
  }
  return ` ${WORK} ${type} ${location} `;
};

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();
  const windows = [
    new GrowingWindow(() => getRunStats(ns), true),
    new GrowingWindow(() => getPlayerLevels(ns)),
    new GrowingWindow(() =>
      table(
        ns,
        ['SERVICES', '', ''],
        getServices(ns).map((/** @type {{name: string, status: string, ram: number}} */ { name, status, ram }) =>
          [name, status, '  ' + MEDIUM(ram.toFixed(2)+'GB')]),
        { colors: true },
      ),
    ),
    !hasBitNode(ns, 4) && new GrowingWindow(() => backdoorPath(ns)),
    new GrowingWindow(() => threadpoolTable(ns)),
    new GrowingWindow(() => goalsTable(ns)),
    new GrowingWindow(() => moneyTable(ns)),
  ].filter(Boolean);
  await ns.sleep(1);
  const WIDTH = 1200;
  const HEIGHT = 400;
  ns.ui.resizeTail(WIDTH, HEIGHT);
  const clientWidth = eval('doc' + 'ument.body')?.clientWidth;
  if (clientWidth) ns.ui.moveTail(clientWidth - WIDTH - 2, 2);
  while (true) {
    try {
      await getTailModal(ns);
      const width = await getModalColumnCount(ns);

      if (width != null) {
        const textField = renderWindows(windows, width);

        ns.clearLog();
        textField.split("\n").forEach((/** @type {string} */ line) => ns.print(line));
        await ns.sleep(1);

        // colorize(modal.bottom);
      }
    } catch (error) {
      if (error?.name === 'ScriptDeath') throw error;
      console.error(error);
    }
    await ns.sleep(1000);
  }
}

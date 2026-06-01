import { THREADPOOL } from '../etc/config';
import {
  getStaticData,
  getMoneyData,
  getPlayerData,
  getSchedulerReportData,
} from '../lib/data-store';
import { getGoals } from '../lib/goals/goals';
import { GrowingWindow, renderWindows } from '../lib/layout';
import { getTailModal, getModalColumnCount } from '../lib/modal';
import { table } from '../lib/table';
import { getServices } from '../lib/service-api';
import { C, WARN, MEDIUM, BRIGHT, ERROR } from '../lib/colors';
import { hasBitNode } from '../lib/query-service';
import { by } from '../lib/util';

const H = BRIGHT.BOLD;

/** @param {number|null} seconds */
const formatTime = (seconds) => {
  if (seconds == null) {
    return '?';
  }
  if (seconds === 0) {
    return '';
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const coalesce = (...nums) => {
    if (nums.length === 0) {
      return '';
    }
    const [first, ...rest] = nums;
    if (first === 0) {
      return coalesce(...rest);
    }
    return nums.map((n) => n.toString().padStart(2, '0')).join(':');
  };
  return coalesce(h, m, s);
};

const getRunStats = (ns: NS) => {
  const { resetInfo } = getStaticData(ns);
  const { city, hp, numPeopleKilled, money } = getPlayerData(ns).player;
  const { onlineRunningTime = 0 } =
    ns.getRunningScript('/bin/scheduler.ts', 'home') || {};
  const { estimatedStockValue = 0 } = getMoneyData(ns);

  const karma = Math.trunc(ns.heart.break());
  const BN = `BN${resetInfo.currentNode}`;
  const uptime = formatTime(onlineRunningTime);
  const augRunningTime = (Date.now() - resetInfo.lastAugReset) / 1000;
  const hasFullUptime = augRunningTime - onlineRunningTime < 10;
  const bnTime = formatTime((Date.now() - resetInfo.lastNodeReset) / 1000);
  const augTime = formatTime(augRunningTime);
  const time = hasFullUptime ? uptime : uptime + '/' + augTime;
  const stock = ns.format.number(estimatedStockValue, 1);
  return [
    ' ' + H(BN) + ' ' + bnTime,
    H('UP') + ' ' + time,
    H('CITY') + ' ' + city,
    H('HP') + ' ' + C(170)(`${hp.current}/${hp.max}`),
    H('CASH') + C(217)(` $${ns.format.number(money, 1).padEnd(6)}`),
    H('PORTFOLIO') + C(217)(` $${stock}`),
    H('KILLS') + ' ' + numPeopleKilled,
    H('KARMA') + ' ' + karma,
    getWork(ns),
  ].join('  ');
};

const getPlayerLevels = (ns: NS) => {
  const { skills } = getPlayerData(ns).player;
  const { resetInfo, augmentationStats = {} } = getStaticData(ns);

  const stat = (stat: keyof Multipliers) => {
    let p = 1;
    for (const [aug, count] of resetInfo.ownedAugs.entries())
      p *= (augmentationStats[aug]?.[stat] ?? 1) ** count;
    return p;
  };

  const G = C(72);
  const W = C(251);
  const M = MEDIUM;

  const fmt = (v: number) => M('x' + v.toFixed(3));
  return table(ns, null, [
    ['', '', M('mult'), M('exp')],
    [
      G('Hack'),
      G(skills.hacking),
      fmt(stat('hacking')),
      fmt(stat('hacking_exp')),
    ],
    [
      W('Str'),
      W(skills.strength),
      fmt(stat('strength')),
      fmt(stat('strength_exp')),
    ],
    [
      W('Def'),
      W(skills.defense),
      fmt(stat('defense')),
      fmt(stat('defense_exp')),
    ],
    [
      W('Dex'),
      W(skills.dexterity),
      fmt(stat('dexterity')),
      fmt(stat('dexterity_exp')),
    ],
    [
      W('Agi'),
      W(skills.agility),
      fmt(stat('agility')),
      fmt(stat('agility_exp')),
    ],
    [
      W('Cha'),
      W(skills.charisma),
      fmt(stat('charisma')),
      fmt(stat('charisma_exp')),
    ],
  ]);
};

const threadpoolRow = (ns: NS, server: Server) => {
  const { ramUsed, maxRam } = server;
  const ram = `${ns.format.ram(ramUsed, 0).padStart(5)}/${ns.format.ram(maxRam, 0).padEnd(5)}`;
  return [ram];
};

const threadpools = (ns: NS) => {
  const names = Array(ns.cloud.getServerLimit())
    .fill(null)
    .map((_, i) => (i + 1).toString().padStart(2, '0'))
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

const threadpoolTable = (ns: NS) => {
  const { purchasedServerLimit } = getStaticData(ns);
  const third = Math.ceil(purchasedServerLimit / 3);
  const data = threadpools(ns);
  const left = data.slice(0, third);
  const middle = data.slice(third, third * 2);
  const right = data.slice(third * 2);
  const rows = left.map((list, i) =>
    [...list, ...(middle[i] || ['']), ...(right[i] || [''])].map(MEDIUM),
  );
  return BRIGHT.BOLD(' SERVERS ') + '\n' + table(ns, null, rows);
};

const goalsTable = (/** @type {NS} */ ns) => {
  const goals = getGoals(ns);
  return table(
    ns,
    ['GOALS', { name: '', align: 'right' }],
    goals.map((goal) => [
      goal.toString(),
      MEDIUM(formatTime(goal.timeToComplete())),
    ]),
    { colors: true },
  );
};

const moneyTable = (/** @type {NS} */ ns) => {
  const moneyData = getMoneyData(ns);
  if (moneyData == null) {
    return ` ${H('INCOME')} \n ${MEDIUM(loading)} `;
  }
  const {
    theftIncome = 0,
    thiefReferenceWindow = 0,
    hacknetIncome = 0,
    gangIncome = 0,
    referenceIncome = 0,
  } = moneyData;
  const rows = [
    [' Theft', `$${ns.format.number(theftIncome, 1)}/s`],
    ['', formatTime(thiefReferenceWindow)],
    [' Hacknet', `$${ns.format.number(hacknetIncome, 1)}/s`],
    [' Gang', `$${ns.format.number(gangIncome, 1)}/s`],
  ];
  const top =
    H(' INCOME    ') + C(183)(`$${ns.format.number(referenceIncome, 1)}/s`);
  return top + '\n' + table(ns, null, rows);
};

const getWork = (ns: NS) => {
  const { factionRep = {}, currentWork } = getPlayerData(ns);
  const { location } = getPlayerData(ns).player;
  const WORK = H('WORK');
  if (!hasBitNode(ns, 4)) return ` ${WORK} ${MEDIUM('(unknown)')} `;
  if (currentWork == null) return ` ${WORK} ${MEDIUM('(idle)')} `;
  const {
    type,
    crimeType,
    companyName,
    factionName,
    // workMoneyGained,
    // workRepGained,
  } = currentWork;
  if (type === 'FACTION') {
    const rep = Math.floor(factionRep[factionName]);
    return ` ${WORK} ${factionName} ${MEDIUM(`(${rep} rep)`)} `;
  } else if (type === 'COMPANY') {
    return ` ${WORK} ${companyName} `;
  } else if (type === 'CRIME') {
    return ` ${WORK} ${crimeType} `;
  }
  return ` ${WORK} ${type} ${location} `;
};

const getExecutionTable = (ns: NS) => {
  const { lastRuns = {}, lastCancellations = {} } = getSchedulerReportData(ns);
  const rows = Object.entries(lastCancellations)
    .filter(([script, cancelTime]) => lastRuns[script] < cancelTime)
    .map(([script]) => [script, lastRuns[script] ?? Infinity])
    .sort(by(([, lastRun]) => lastRun))
    .map(([script, lastRun]) => [script, (Date.now() - lastRun) / 1000])
    .filter(([, lastRun]) => +lastRun >= 10)
    .map(([script, timeSince]) => [
      script.replace(/^\/bin\//, ''),
      formatTime(timeSince),
    ]);
  return ` ${H('DELAYS')} \n` + table(ns, null, rows);
};

const getServiceTable = (ns: NS) => {
  return table(
    ns,
    ['SERVICES', '', ''],
    getServices(ns).map(
      (
        /** @type {{name: string, status: string, ram: number}} */ {
          name,
          status,
          ram,
        },
      ) => [
        name,
        status,
        '  ' + (ram ? MEDIUM(ram.toFixed(2) + 'GB') : ERROR('error')),
      ],
    ),
    { colors: true },
  );
};

const getSchedulerTable = (ns: NS) => {
  const {
    inputFull,
    outputFull,
    heartbeat,
    maxWaitTime = 0,
    enqueueFails = 0,
    droppedTickets = 0,
  } = getSchedulerReportData(ns);
  const age = heartbeat == null ? null : Date.now() - heartbeat;
  const heartbeatStr =
    age == null
      ? ERROR('no data')
      : age > 5000
        ? ERROR(`${(age / 1000).toFixed(1)}s ago`)
        : `${age}ms ago`;
  const waitSec = (maxWaitTime / 1000).toFixed(1);
  const waitStr =
    maxWaitTime > 45000
      ? ERROR(`${waitSec}s`)
      : maxWaitTime > 20000
        ? WARN(`${waitSec}s`)
        : `${waitSec}s`;
  const queue = enqueueFails + ' fails';
  const tickets = droppedTickets + ' dropped';
  const rows = [
    ['SCHEDULER'],
    ['Heartbeat  ' + heartbeatStr],
    ['Max wait   ' + waitStr],
    ['Input      ' + (inputFull ? ERROR('full') : 'open')],
    ['Output     ' + (outputFull ? ERROR('full') : 'open')],
    ['Queue      ' + (enqueueFails > 0 ? ERROR(queue) : queue)],
    ['Tickets    ' + (droppedTickets > 0 ? ERROR(tickets) : tickets)],
  ];
  return table(ns, null, rows, { colors: true });
};

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.ui.openTail();
  const windows = [
    new GrowingWindow(() => getRunStats(ns), true),
    new GrowingWindow(() => getServiceTable(ns)),
    new GrowingWindow(() => getSchedulerTable(ns)),
    new GrowingWindow(() => moneyTable(ns)),
    new GrowingWindow(() => goalsTable(ns)),
    new GrowingWindow(() => getPlayerLevels(ns)),
    new GrowingWindow(() => threadpoolTable(ns)),
    new GrowingWindow(() => getExecutionTable(ns)),
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
        textField
          .split('\n')
          .forEach((/** @type {string} */ line) => ns.print(line));
        await ns.sleep(1);
      }
    } catch (error) {
      if (error?.name === 'ScriptDeath') throw error;
      console.error(error);
    }
    await ns.sleep(1000);
  }
}

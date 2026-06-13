import { THREADPOOL } from '../etc/config';
import {
  getStaticData,
  getMoneyData,
  getPlayerData,
  getSchedulerReportData,
  getHostnames,
} from '../lib/data-store';
import { getGoals } from '../lib/goals/goals';
import { GrowingWindow, renderWindows } from '../lib/layout';
import { getTailModal, getModalColumnCount } from '../lib/modal';
import { table } from '../lib/table';
import { getServices } from '../lib/service-api';
import { C, WARN, MEDIUM, BRIGHT, ERROR, MONEY } from '../lib/colors';
import { getIncome, hasBitNode } from '../lib/query-service';
import { by } from '../lib/util';
import { Goal } from '../lib/goals/nodes';
import { SHARE } from '../etc/filenames';

const H = BRIGHT.BOLD;

const formatTime = (seconds: number | null, emptyZero = false) => {
  if (seconds == null) {
    return '?';
  }
  if (emptyZero && seconds === 0) {
    return '';
  }
  const pad = (n: number) => n.toString().padStart(2, '0');
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h === 0 && m === 0) {
    return ':' + pad(s);
  } else if (h === 0) {
    return `${pad(m)}:${pad(s)}`;
  } else {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
};

const getRunStats = (ns: NS) => {
  const { resetInfo } = getStaticData(ns);
  const { city, hp, numPeopleKilled, money } = getPlayerData(ns).player;
  const { onlineRunningTime = 0 } =
    ns.getRunningScript('/bin/scheduler.ts', 'home') || {};
  const { estimatedStockValue = 0 } = getMoneyData(ns);

  const getSF = () => {
    const prevSF = resetInfo.ownedSF.get(resetInfo.currentNode) ?? 0;
    const maxSF = resetInfo.currentNode === 12 ? Infinity : 3;
    return Math.min(prevSF + 1, maxSF);
  };

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
    ' ' + H(BN) + '.' + BRIGHT(getSF()) + ' ' + bnTime,
    H('UP') + ' ' + time,
    H('CITY') + ' ' + city,
    H('HP') + ' ' + C(170)(`${hp.current}/${hp.max}`),
    H('CASH') + MONEY(` $${ns.format.number(money, 1).padEnd(6)}`),
    H('PORTFOLIO') + MONEY(` $${stock}`),
    H('KILLS') + ' ' + numPeopleKilled,
    H('KARMA') + ' ' + karma,
    getWork(ns),
  ].join('  ');
};

const getPlayerLevels = (ns: NS) => {
  const { skills, mults } = getPlayerData(ns).player;

  const G = C(72);
  const W = C(251);
  const M = MEDIUM;

  const fmt = (v: number) => M('x' + v.toFixed(3));
  return table(ns, null, [
    ['', '', M('mult'), M('exp')],
    [G('Hack'), G(skills.hacking), fmt(mults.hacking), fmt(mults.hacking_exp)],
    [
      W('Str'),
      W(skills.strength),
      fmt(mults.strength),
      fmt(mults.strength_exp),
    ],
    [W('Def'), W(skills.defense), fmt(mults.defense), fmt(mults.defense_exp)],
    [
      W('Dex'),
      W(skills.dexterity),
      fmt(mults.dexterity),
      fmt(mults.dexterity_exp),
    ],
    [W('Agi'), W(skills.agility), fmt(mults.agility), fmt(mults.agility_exp)],
    [
      W('Cha'),
      W(skills.charisma),
      fmt(mults.charisma),
      fmt(mults.charisma_exp),
    ],
  ]);
};

const threadpoolRow = (ns: NS, server: { ramUsed: number; maxRam: number }) => {
  const { ramUsed, maxRam } = server;
  const ram = `${ns.format.ram(ramUsed, 0).padStart(5)}/${ns.format.ram(maxRam, 0).padEnd(5)}`;
  return [ramUsed === maxRam ? BRIGHT(ram) : MEDIUM(ram)];
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
    .filter((server) => server != null)
    .map((server) => threadpoolRow(ns, server));
};

const threadpoolTable = (ns: NS) => {
  const { purchasedServerLimit } = getStaticData(ns);
  const third = Math.ceil(purchasedServerLimit / 3);
  const data = threadpools(ns);
  const left = data.slice(0, third);
  const middle = data.slice(third, third * 2);
  const right = data.slice(third * 2);
  const rows = left.map((list, i) => [
    ...list,
    ...(middle[i] || ['']),
    ...(right[i] || ['']),
  ]);
  return BRIGHT.BOLD(' SERVERS ') + '\n' + table(ns, null, rows);
};

const goalsTable = (ns: NS) => {
  const root = getGoals(ns);
  const rows = [];
  const walk = (goal: Goal, depth: number) => {
    for (const dep of goal.deps) walk(dep, depth + 1);
    rows.push([
      '  '.repeat(depth) + goal.toString(),
      MEDIUM(formatTime(goal.timeToComplete(), true)),
    ]);
  };
  walk(root, 0);
  const actionItems = root.actions.map((action) =>
    action.type === 'BUY_AUG'
      ? action.name
      : `Buy ${ns.format.number(action.amount)} rep (${action.faction})`,
  );
  for (let i = 0; i < actionItems.length; i++) {
    const isLast = i === actionItems.length - 1;
    const lead = !isLast ? '├' : '└';
    const item = actionItems[i];
    rows.push([C(236)(lead) + ' ' + C(56)(item), '']);
  }
  return table(ns, ['GOALS', { name: '', align: 'right' }], rows, {
    colors: true,
  });
};

const moneyTable = (ns: NS) => {
  const moneyData = getMoneyData(ns);
  if (moneyData == null) {
    return ` ${H('INCOME')} \n ${MEDIUM('loading')} `;
  }
  const {
    theftIncome = 0,
    hacknetIncome = 0,
    gangIncome = 0,
    stockIncome = 0,
    totalIncome = 0,
  } = getIncome(ns);
  const rows = [
    [' Theft', `$${ns.format.number(theftIncome, 1)}/s`],
    [' Hacknet', `$${ns.format.number(hacknetIncome, 1)}/s`],
    [' Gang', `$${ns.format.number(gangIncome, 1)}/s`],
    [' Stocks', `$${ns.format.number(stockIncome, 1)}/s`],
  ];
  const top =
    H(' INCOME    ') + C(183)(`$${ns.format.number(totalIncome, 1)}/s`);
  return top + '\n' + table(ns, null, rows);
};

const getWork = (ns: NS) => {
  const { factionRep, currentWork } = getPlayerData(ns);
  const { location } = getPlayerData(ns).player;
  const WORK = H('WORK');
  if (!hasBitNode(ns, 4)) return ` ${WORK} ${MEDIUM('(unknown)')} `;
  if (currentWork == null) return ` ${WORK} ${MEDIUM('(idle)')} `;
  if (currentWork.type === 'FACTION') {
    const { factionName } = currentWork;
    const rep = Math.floor(factionRep?.[factionName] ?? 0);
    return ` ${WORK} ${factionName} ${MEDIUM(`(${rep} rep)`)} `;
  } else if (currentWork.type === 'COMPANY') {
    return ` ${WORK} ${currentWork.companyName} `;
  } else if (currentWork.type === 'CRIME') {
    return ` ${WORK} ${currentWork.crimeType} `;
  }
  return ` ${WORK} ${currentWork.type} ${location} `;
};

const getExecutionTable = (ns: NS) => {
  const { lastRuns = {}, lastCancellations = {} } = getSchedulerReportData(ns);
  const rows = Object.entries(lastCancellations)
    .filter(([script, cancelTime]) => lastRuns[script] < cancelTime)
    .map(
      ([script]) => [script, lastRuns[script] ?? Infinity] as [string, number],
    )
    .sort(by(([, lastRun]) => lastRun))
    .map(
      ([script, lastRun]) =>
        [script, (Date.now() - lastRun) / 1000] as [string, number],
    )
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
    getServices(ns).map(({ name, status, ram }) => [
      name,
      status,
      '  ' + (ram ? MEDIUM(ram.toFixed(2) + 'GB') : ERROR('error')),
    ]),
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
  const processes = getHostnames(ns).flatMap((hostname) => ns.ps(hostname));
  const sharePs = processes.filter((ps) =>
    ps.filename.includes(SHARE.slice(1)),
  );
  const rows = [
    ['SCHEDULER'],
    ['Heartbeat  ' + heartbeatStr],
    ['Max wait   ' + waitStr],
    ['Input      ' + (inputFull ? ERROR('full') : 'open')],
    ['Output     ' + (outputFull ? ERROR('full') : 'open')],
    ['Queue      ' + (enqueueFails > 0 ? ERROR(queue) : queue)],
    ['Tickets    ' + (droppedTickets > 0 ? ERROR(tickets) : tickets)],
    ['Processes  ' + processes.length],
    [
      'Share Thd  ' +
        sharePs.map((ps) => ps.threads).reduce((a, b) => a + b, 0),
    ],
    ['Share Pwr  ' + ns.format.number(ns.getSharePower(), 3)],
  ];
  return table(ns, null, rows, { colors: true });
};

const getHackingTable = (ns: NS) => {
  const { theft } = getMoneyData(ns);
  const rows =
    theft == null
      ? [['HACKING'], [MEDIUM('(loading)')]]
      : [
          ['HACKING'],
          [theft.target],
          ['$' + ns.format.number(theft.money, 1)],
          [formatTime(Math.max(0, (theft.endTime - Date.now()) / 1000))],
          ['$' + ns.format.number(theft.incomeRate, 1) + '/s'],
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
    new GrowingWindow(() => getHackingTable(ns)),
  ].filter(Boolean);
  await ns.sleep(1);
  const WIDTH = 1300;
  const HEIGHT = 500;
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
        textField.split('\n').forEach((line) => ns.print(line));
        await ns.sleep(1);
      }
    } catch (error) {
      if (
        error != null &&
        typeof error === 'object' &&
        'name' in error &&
        error?.name === 'ScriptDeath'
      )
        throw error;
      console.error(error);
    }
    await ns.sleep(1000);
  }
}

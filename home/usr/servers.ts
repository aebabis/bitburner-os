import { by, small } from '../lib/util';
import { nmap } from '../lib/nmap';
import { table } from '../lib/table';
import { THREADPOOL } from '../etc/config';

const getServers = (ns: NS) =>
  nmap(ns)
    .filter((name) => name !== 'home' && !name.startsWith(THREADPOOL))
    .map(ns.getServer)
    .sort(by('hostname'))
    .sort(by('maxRam'))
    .sort(by('requiredHackingSkill'));

const serverRow = (ns: NS, server: Server) => {
  const {
    backdoorInstalled,
    hasAdminRights,
    hostname,
    ramUsed,
    maxRam,
    numOpenPortsRequired,
    requiredHackingSkill,
    hackDifficulty,
    minDifficulty,
    moneyAvailable,
    moneyMax,
  } = server;

  const status = backdoorInstalled
    ? '💻 '
    : hasAdminRights
      ? '🔗 '
      : '❌\u200b ';
  const name = `${status}${hostname}${small(numOpenPortsRequired ?? 0)}`;
  const money = `${ns.format.number(moneyAvailable ?? 0, 2)}/${ns.format.number(moneyMax ?? 0, 2)}`;
  const ram = `${ns.format.ram(ramUsed ?? 0)}/${ns.format.ram(maxRam)}`;
  const level = requiredHackingSkill ?? 0;
  const hacking = `${~~(minDifficulty ?? 0)}/${~~(hackDifficulty ?? 0)}`;
  return {
    name,
    money,
    ram,
    level,
    hacking,
  };
};

const getTable = (ns: NS) => {
  const columns = [
    '\u2796\u200b HOSTNAME' + small('ports'),
    'MONEY',
    'RAM',
    'LEVEL',
    'HACKING',
  ];
  const data = getServers(ns)
    .map((server) => serverRow(ns, server))
    .map(({ name, money, ram, level, hacking }) => [
      name,
      money,
      ram,
      level,
      hacking,
    ]);
  const mid = Math.ceil(data.length / 2);
  const left = data.slice(0, mid);
  const right = data.slice(mid);
  const doubled = left.map((row, i) => [...row, ...(right[i] || [])]);

  return table(ns, [...columns, ...columns], doubled, { colors: true });
};

export async function main(ns: NS) {
  ns.disableLog('ALL');

  const [command] = ns.args;

  if (command == null) {
    ns.tprint('\n' + getTable(ns));
  } else {
    if (command === 'service') {
      while (true) {
        ns.clearLog();
        ns.print(getTable(ns));
        await ns.sleep(5000);
      }
    } else {
      throw new Error('Illegal argument: ' + command); // TODO: Usage
    }
  }
}

import { KEYWORD, NORMAL } from './lib/colors';
import { table } from './lib/table';

const MAIN = {
  start: 'Boots the system and services',
  stop: 'Kill all scripts on all servers',
  restart: 'Kill all scripts and start again',
  services: 'View and manually control services',
};

const SHORTHAND = {
  c: 'connect',
  bd: 'backdoor',
  h: 'home',
  b: 'buy port programs',
};

const UTILITIES = {
  'aug-table': {
    command: 'dispatch bin/goals.ts aug-table',
    desc: 'Show augmentation scoring table',
  },
  config: {
    command: './config.ts',
    desc: 'Global config variables',
  },
  data: {
    command: './data.ts',
    desc: 'View stored by various services',
  },
  dispatch: {
    command: 'bin/dispatch.ts',
    desc: 'Tell scheduler to run a program',
  },
  liquidate: {
    command: 'dispatch bin/liquidate.ts',
    desc: 'Sell all stocks and stop spending',
  },
  nmap: {
    command: 'dispatch usr/nmap-gui.ts',
    desc: 'Graphical network map',
  },
  read: {
    command: 'usr/read.ts',
    desc: 'Open a file in a live reader',
  },
  readme: {
    command: './readme.ts',
    desc: 'View this help',
  },
  reset: {
    command: 'usr/reset.ts',
    desc: 'Soft reset',
  },
  servers: {
    command: 'dispatch usr/servers.ts',
    desc: 'List non-purchased servers',
  },
  services: {
    command: 'bin/services.ts',
    desc: 'View and manage installed services',
  },
  update: {
    command: 'home; killall; update.ts',
    desc: 'Download most recent code from GitHub',
  },
};

const UTILITY_ALIASES = Object.fromEntries(
  Object.entries(UTILITIES).map(([alias, entry]) => [alias, entry.command]),
);
const UTILITY_DESCRIPTIONS = Object.fromEntries(
  Object.entries(UTILITIES).map(([alias, entry]) => [alias, entry.desc]),
);

const ALIASES = {
  // Main
  start: 'home; ./start.ts',
  stop: 'home; kill /bin/scheduler.ts; ./stop.ts',
  restart: 'home; kill /bin/scheduler.ts; ./stop.ts start.ts',
  services: './services.ts',

  // Shorthand
  c: 'connect',
  bd: 'backdoor',
  h: 'home',
  b: 'buy BruteSSH.exe; buy FTPCrack.exe; buy relaySMTP.exe; buy HTTPWorm.exe; buy SQLInject.exe',

  // Other utilities
  ...UTILITY_ALIASES,
};

const getLines = (commands: Record<string, string>) => {
  const lines = [];
  for (const [command, desc] of Object.entries(commands))
    lines.push(KEYWORD.BOLD + command, NORMAL + '  ' + desc);
  return lines;
};

const getHelp = (ns: NS) => {
  const column1 = getLines(UTILITY_DESCRIPTIONS);
  const column2 = [...getLines(MAIN), ' ', ...getLines(SHORTHAND)];
  const iters = Math.max(column1.length, column2.length);
  const rows = [];
  for (let i = 0; i < iters; i++)
    rows.push([column1[i] || '', column2[i] || '']);
  return table(ns, ['', ''], rows);
};

const getAliases = () =>
  KEYWORD.BOLD +
  Object.entries(ALIASES)
    .map(([alias, command]) => `alias ${alias}=${JSON.stringify(command)}`)
    .join(';');

export async function main(ns: NS) {
  const [command] = ns.args;
  if (command == null) ns.tprint('\n' + getHelp(ns) + '\n\n');
  else if (command === 'aliases') ns.tprint(getAliases());
}

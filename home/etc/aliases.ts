export type Alias = {
  command: string;
  desc: string;
};

export const CORE_ALIASES = {
  start: {
    command: 'home; ./start.ts',
    desc: 'Boots the system and services',
  },
  stop: {
    command: 'home; kill /bin/planner.ts; ./stop.ts',
    desc: 'Kill all scripts on all servers',
  },
  restart: {
    command: 'home; kill /bin/planner.ts; ./stop.ts start.ts',
    desc: 'Kill all scripts and start again',
  },
  services: {
    command: './services.ts',
    desc: 'View and manually control services',
  },
} as Record<string, Alias>;

export const SHORTHAND_ALIASES = {
  c: {
    command: 'connect',
    desc: 'connect',
  },
  bd: {
    command: 'backdoor',
    desc: 'backdoor',
  },
  h: {
    command: 'home',
    desc: 'home',
  },
  b: {
    command:
      'buy BruteSSH.exe; buy FTPCrack.exe; buy relaySMTP.exe; buy HTTPWorm.exe; buy SQLInject.exe',
    desc: 'buy port programs',
  },
} as Record<string, Alias>;

export const UTILITY_ALIASES = {
  'aug-table': {
    command: 'dispatch bin/goals.ts aug-table',
    desc: 'Show augmentation scoring table',
  },
  bitflume: {
    command: 'home; killall; ./usr/bitflume.ts',
    desc: 'Go to BN of choice',
  },
  config: {
    command: './config.ts',
    desc: 'Global config variables',
  },
  data: {
    command: 'usr/data.ts',
    desc: 'View stored by various services',
  },
  dhud: {
    command: 'home; usr/tail.ts dhud',
    desc: 'Open the darknet server table',
  },
  dispatch: {
    command: 'bin/dispatch.ts',
    desc: 'Tell planner to run a program',
  },
  eval: {
    command: 'usr/eval.ts',
    desc: 'Run "ns.api.call()" from the command line',
  },
  liquidate: {
    command: 'dispatch usr/liquidate.ts',
    desc: 'Sell all stocks and stop spending',
  },
  lr: {
    command: 'home; cat log/last-reset.txt',
    desc: "Show last install's log",
  },
  makecct: {
    command: 'usr/make-cct.ts',
    desc: 'Create a test coding contract',
  },
  nmap: {
    command: 'usr/nmap.ts',
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
    command: 'usr/services.ts',
    desc: 'View and manage installed services',
  },
  tail: {
    command: 'home; usr/tail.ts',
    desc: 'Open tail window by PID or partial filename match',
  },
  test: {
    command: 'home; lib/test/run-all.ts',
    desc: 'Run unit tests on script suite utilities and libraries',
  },
  testcct: {
    command: 'home; usr/cct-battery.ts',
    desc: 'Mass-generate contracts and test the solvers',
  },
  update: {
    command: 'home; killall; ./stop.ts update.ts',
    desc: 'Download most recent code from GitHub',
  },
} as Record<string, Alias>;

export const ALIASES = {
  ...CORE_ALIASES,
  ...SHORTHAND_ALIASES,
  ...UTILITY_ALIASES,
};

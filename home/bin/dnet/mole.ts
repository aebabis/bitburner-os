// isConnectedToCurrentServer: boolean;
// hasSession: boolean;
// modelId: string;
// passwordHint: string;
// data: string;
// logTrafficInterval: number;
// passwordLength: number;
// passwordFormat: "numeric" | "alphabetic" | "alphanumeric" | "ASCII" | "unicode";
// blockedRam: number;
// difficulty: number;
// depth: number;
// requiredCharismaSkill: number;
// isStationary: boolean;
//
const EU_COUNTRIES = [
  'Austria',
  'Belgium',
  'Bulgaria',
  'Croatia',
  'Cyprus',
  'Czechia',
  'Czech',
  'Denmark',
  'Estonia',
  'Finland',
  'France',
  'Germany',
  'Greece',
  'Hungary',
  'Ireland',
  'Italy',
  'Latvia',
  'Lithuania',
  'Luxembourg',
  'Malta',
  'Netherlands',
  'Poland',
  'Portugal',
  'Romania',
  'Slovakia',
  'Slovenia',
  'Spain',
  'Sweden',
];
const romanToInt = (numeralString: string) => {
  if (numeralString === 'nulla') return 0;
  const numeralValues = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  } as const;
  type Numeral = keyof typeof numeralValues;
  const numerals = numeralString.split('') as Numeral[];
  return numerals
    .map((num) => numeralValues[num])
    .map((num, i, arr) => (num < arr[i + 1] ? -num : num))
    .reduce((a, b) => a + b, 0);
};

const solveXor = (input: string) => {
  const [cypher, mask] = input.split(';');
  const masks = mask.split(' ').map((n) => parseInt(n, 2));
  return [...cypher]
    .map((c, i) => c.charCodeAt(0) ^ masks[i])
    .map((n) => String.fromCharCode(n))
    .join('');
};

function* permutationGenerator(arr: string[]): Generator<string> {
  if (arr.length <= 1) {
    yield arr.join('');
    return;
  }
  for (let i = 0; i < arr.length; i++) {
    const current = arr[i];
    const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const permutation of permutationGenerator(remaining)) {
      yield [current, ...permutation].join('');
    }
  }
}

function* numeralSequenceGenerator(length: number): Generator<string> {
  if (length === 0) {
    yield '';
    return;
  }
  for (const end of numeralSequenceGenerator(length - 1)) {
    for (const numeral of '0123456789') {
      yield end + numeral;
    }
  }
}

const mastermindSolver = (ns: NS, hostname: string, details: DarknetServerDetails) => {
  type MastermindRule = { password: string; exact: number; wrongPlace: number };
  const rules = [] as MastermindRule[];
  ns.disableLog('ALL');
  const matches = (password: string, rule: MastermindRule) => {
    const numExact = [...password].filter((c, i) => c === rule.password[i]).length;
    return numExact === rule.exact;
  };
  const generator = numeralSequenceGenerator(details.passwordLength);
  let next = generator.next();
  return heartbleedSolver(
    ns,
    hostname,
  )(async ({ jsonLogs }, shouldYield) => {
    for (const { data, passwordAttempted } of jsonLogs) {
      const newRule = { password: passwordAttempted, exact: +data[0], wrongPlace: +data[1] };
      if (
        !rules.find(
          ({ password, exact, wrongPlace }) =>
            password === newRule.password &&
            exact === newRule.exact &&
            wrongPlace === newRule.wrongPlace,
        )
      ) {
        rules.push(newRule);
      }
    }
    while (!next.done) {
      const guess = next.value;
      next = generator.next();
      if (rules.every((rule) => matches(guess, rule))) return guess;
      if (shouldYield()) await ns.sleep(0);
    }
    return null;
  });
};

const WALL = '█' as const;
const HALL = ' ' as const;
const GOAL = 'X' as const;
type MAZE_CELL = typeof WALL | typeof HALL | typeof GOAL;

// The password is the largest prime factor of
type Coord = `${number},${number}`;
const mazeSolver = (ns: NS, hostname: string) => async () => {
  if (ns.dnet.getStasisLinkedServers().includes(ns.getHostname())) {
    ns.disableLog('ALL');
    ns.ui.openTail();
  }
  const maze = {} as Record<Coord, MAZE_CELL | undefined>;
  const stepToNewSpot = (coords: readonly [number, number]) => {
    const directions = [
      { name: 'north', dx: 0, dy: -1 },
      { name: 'east', dx: 1, dy: 0 },
      { name: 'south', dx: 0, dy: 1 },
      { name: 'west', dx: -1, dy: 0 },
    ] as const;
    const [startX, startY] = coords;
    const startCoord: Coord = `${startX},${startY}`;
    const queue = directions
      .filter(({ dx, dy }) => maze[`${startX + dx},${startY + dy}`] === HALL)
      .map(({ name, dx, dy }) => ({ x: startX + dx * 2, y: startY + dy * 2, firstStep: name }));
    ns.print(queue);
    const seen = new Set<Coord>([startCoord]);
    while (queue.length) {
      const { x, y, firstStep } = queue.shift()!;
      const currentCoord: Coord = `${x},${y}`;
      ns.print('considering: ' + currentCoord + ':' + maze[currentCoord]);
      if (maze[currentCoord] === GOAL || maze[currentCoord] === undefined) return firstStep;
      for (const { dx, dy } of directions) {
        ns.print('  looking: ' + `${x + dx},${y + dy}` + ':' + maze[`${x + dx},${y + dy}`]);
        if (maze[`${x + dx},${y + dy}`] === WALL) continue;
        const nx = x + dx * 2;
        const ny = y + dy * 2;
        const nCoord: Coord = `${nx},${ny}`;
        ns.print('    seen: ' + seen.has(nCoord));
        if (!seen.has(nCoord)) {
          seen.add(nCoord);
          queue.push({ x: nx, y: ny, firstStep });
        }
      }
      ns.print(queue.length);
    }
    return 'south';
  };
  const printMaze = (currX: number, currY: number) => {
    const allCoords = [...Object.keys(maze).map((coord) => coord.split(',').map(Number))];
    const maxX = Math.max(...allCoords.map(([x]) => x));
    const maxY = Math.max(...allCoords.map(([, y]) => y));
    const rows = [] as string[][];
    for (let y = 0; y <= maxY; y++) {
      const row = [] as string[];
      rows.push(row);
      for (let x = 0; x <= maxX; x++) {
        const coord = `${x},${y}` as Coord;
        if (x === currX && y === currY) row.push('@');
        else row.push(maze[coord] ?? '?');
      }
    }
    ns.print(rows.map((row) => row.join('')).join('\n') + '\n\n');
  };
  type LabReport = {
    coords: [number, number];
    north: boolean;
    east: boolean;
    south: boolean;
    west: boolean;
  };
  while (true) {
    try {
      const labreport = await ns.dnet.labreport();
      const radar = await ns.dnet.labradar();
      if (!labreport.coords || !radar.success) {
        return false;
      }

      const { coords, north, east, south, west } = labreport as LabReport;
      const [x, y] = coords;
      maze[`${x},${y}`] = HALL;
      maze[`${x},${y - 1}`] = north ? HALL : WALL;
      maze[`${x + 1},${y}`] = east ? HALL : WALL;
      maze[`${x},${y + 1}`] = south ? HALL : WALL;
      maze[`${x - 1},${y}`] = west ? HALL : WALL;

      const radarRows = radar.message.split('\n') as string[];
      const offset = Math.floor(radarRows.length / 2);
      for (let dy = -offset; dy <= offset; dy++) {
        for (let dx = -offset; dx <= offset; dx++) {
          const c = radarRows[dy + offset][dx + offset];
          const coord = `${x + dx},${y + dy}` as Coord;
          if (c === '█' || c === ' ' || c === 'X') maze[coord] = c;
        }
      }

      ns.clearLog();
      const nextStep = stepToNewSpot(coords);
      if (nextStep) {
        printMaze(x, y);
        ns.print(radar.success && radar.message);
        const result = await authenticate(ns)(hostname, nextStep);
        if (result.success) return true;
      }
    } catch (error) {
      console.error(error);
      ns.tprint(error);
      return false;
    }
  }
  // TODO: Use heartbleed info to update map
  /* {
  "passwordAttempted": "s",
  "code": 401,
  "message": "You have moved to 1,3.",
  "data": "█ █
           █@█
           █ █"
} */
};

const NO_PASSWORD = [
  'There is no password',
  'The password is not set',
  'The PIN is empty',
  'Did I set a code?',
];
const DEFAULT_PASSWORD = [
  'I never changed the password',
  'The default password is set',
  "It's still the factory settings",
  "It's still the default",
];
const SHUFFLED_PASSWORD = ['The password is shuffled ', 'The PIN uses ', 'The key is made from '];
const PASSWORD_IS = [
  'The secret is ',
  'The password is ',
  'Remember to use ',
  'The key is ',
  'The PIN is ',
  "It's set to ",
];

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = LOWER.toUpperCase();
const ALPHA = [...LOWER, ...UPPER];
const NUMERIC = [...'0123456789'];
const ALPHANUMERIC = [...ALPHA, ...NUMERIC];

type PasswordFormat = 'numeric' | 'alphabetic' | 'alphanumeric' | 'ASCII' | 'unicode';
const getSequence = (passwordFormat: PasswordFormat) => {
  switch (passwordFormat) {
    case 'numeric':
      return NUMERIC.slice();
    case 'alphabetic':
      return ALPHA.slice();
    case 'alphanumeric':
      return ALPHANUMERIC.slice();
    case 'ASCII':
    case 'unicode':
  }
  throw new Error('Unsupported: ' + passwordFormat);
};

type JsonLog = {
  message: string;
  data: string;
  passwordAttempted: string;
  code: number;
};
type HeartbleedSolverLogs = {
  logs: string[];
  textLogs: string[];
  jsonLogs: JsonLog[];
};

const heartbleedSolver =
  (ns: NS, hostname: string, options: HeartbleedOptions = { peek: true }) =>
  (
    getNextPassword: (
      logs: HeartbleedSolverLogs,
      shouldYield: () => boolean,
    ) => Promise<string | null>,
  ) =>
  async () => {
    while (true) {
      const { success, logs } = await ns.dnet.heartbleed(hostname, options);
      if (!success) return false;
      const textLogs = [] as string[];
      const jsonLogs = [] as JsonLog[];
      for (const log of logs) {
        try {
          jsonLogs.push(JSON.parse(log));
        } catch {
          textLogs.push(log);
        }
      }
      const startTime = Date.now();
      const shouldYield = () => Date.now() - startTime > 200;
      const password = await getNextPassword({ logs, textLogs, jsonLogs }, shouldYield);
      if (password == null) return false;
      const result = await authenticate(ns)(hostname, password);
      if (result.success) return true;
    }
  };

const getCracker = (ns: NS, hostname: string, details: DarknetServerDetails) => {
  const recitePassword = (password: string) => async () => {
    if (ns.dnet.connectToSession(hostname, password).success) return true;
    return (await authenticate(ns)(hostname, password)).success;
  };
  const tryPasswords =
    (...passwords: string[]) =>
    async () => {
      for (const password of passwords) {
        if (ns.dnet.connectToSession(hostname, password).success) return true;
        if ((await authenticate(ns)(hostname, password)).success) return true;
      }
      return false;
    };
  const tryPermutations = (generator: Generator<string>) => async () => {
    for (const item of generator) {
      const result = await authenticate(ns)(hostname, item);
      if (result.success) return true;
    }
    return false;
  };

  if (details.passwordLength === 0 || NO_PASSWORD.some((text) => text === details.passwordHint)) {
    return recitePassword('');
  }
  if (details.passwordHint === 'Only a true master may pass') {
    return mastermindSolver(ns, hostname, details);
  }
  if (details.passwordHint.startsWith('You have discovered a dark, mysterious maze')) {
    return mazeSolver(ns, hostname);
  }
  if (details.passwordHint === 'beep boop') {
    return recitePassword(
      details.data
        .split(' ')
        .filter(Boolean)
        .map((bin) => String.fromCharCode(parseInt(bin, 2)))
        .join(''),
    );
  }
  if (details.passwordHint === 'Type the numbers to prove you are human') {
    return recitePassword(details.data.replaceAll(/[^0-9]/g, ''));
  }
  if (details.passwordHint.startsWith('The password is the value of the number')) {
    return recitePassword(romanToInt(details.data).toString());
  }
  if (details.passwordHint.match(/password is the base [^ ]+ number [^ ]+ in base 10/)) {
    const [base, number] = details.data.split(',');
    const b = +base;
    const digits = '0123456789ABCDEF';
    const [whole, decimal = ''] = number.split('.');
    const wholeValue = whole
      .split('')
      .reverse()
      .map((d, i) => digits.indexOf(d) * b ** i);
    const fracValue = decimal.split('').map((d, i) => digits.indexOf(d) * b ** -i);
    const value = ~~[...wholeValue, ...fracValue].reduce((a, b) => a + b, 0);
    return recitePassword(value.toString());
  }
  if (details.passwordHint === 'My favorite EU country') {
    return tryPasswords(...EU_COUNTRIES.filter((str) => str.length === details.passwordLength));
  }
  if (details.passwordHint === '!!🌶️!!') {
    return async () => {
      ns.disableLog('ALL');
      ns.print(hostname);
      const charset = getSequence(details.passwordFormat);
      const charCounts = {} as Record<string, number>;
      ns.print('charset: ' + charset);

      const update = async () => {
        const { success, logs } = await ns.dnet.heartbleed(hostname);
        if (!success) return false;
        for (const log of logs) {
          try {
            const { data, passwordAttempted } = JSON.parse(log);
            ns.print('detected: ' + passwordAttempted);
            const charsUsed = [...new Set(passwordAttempted as string)];
            ns.print('          ' + charsUsed);
            if (passwordAttempted && charsUsed.length === 1) {
              charCounts[passwordAttempted[0]] = data.split('🌶️').length - 1;
            }
          } catch {}
        }
        return true;
      };

      await update();
      while (Object.values(charCounts).reduce((a, b) => a + b, 0) < details.passwordLength) {
        for (const c of charset) {
          const password = new Array(details.passwordLength).fill(c).join('');
          ns.print(password);
          if ((await authenticate(ns)(hostname, password)).success) return true;
          await update();
          ns.print(hostname, charCounts);
        }
      }

      const reducedCharset = Object.entries(charCounts).flatMap(([c, count]) =>
        new Array(count).fill(c),
      );
      ns.print(reducedCharset);

      for (const password of permutationGenerator(reducedCharset)) {
        ns.print('Trying: ' + password);
        const result = await authenticate(ns)(hostname, password);
        if (result.success) return true;
      }
      return false;
    };
  }
  if (details.passwordHint === 'The password is the evaluation of this expression') {
    const expr = details.data
      .replaceAll(/[➕]/g, '+')
      .replaceAll(/[➖]/g, '-')
      .replaceAll(/[÷]/g, '/')
      .replaceAll(/[ҳ]/g, '*');
    if (expr.match(/^[0-9\+\-\*\\(\)/ ]+$/)) {
      return recitePassword(eval(expr));
    }
  }
  if (DEFAULT_PASSWORD.includes(details.passwordHint) || details.passwordHint.includes('default')) {
    if (details.passwordLength === 0) return recitePassword('');
    if (details.passwordLength === 4) return recitePassword('0000');
    if (details.passwordLength === 5) return tryPasswords('12345', 'admin');
    if (details.passwordLength === 8) return recitePassword('password');
  }

  if (details.passwordHint === "It's a common password") {
    return async () => {
      const LEAD = 'Some common passwords include ';
      const data = ns.peek(DARKNET_FILES) as Record<string, Record<string, string>>;
      const servers = Object.values(data);
      const files = servers.flatMap((server) => Object.values(server));
      const passwords = new Set(
        files
          .filter((content) => content.startsWith(LEAD))
          .flatMap((str) => str.replace(LEAD, '').replaceAll(',', '').split(' '))
          .filter((str) => str.length === details.passwordLength),
      );
      for (const password of passwords) {
        const result = await authenticate(ns)(hostname, password);
        if (result.success) return true;
      }
      return false;
    };
  }
  if (details.passwordHint === "(I'm busy browsing social media at the cafe)") {
    return async () => {
      const { logs, success } = await ns.dnet.heartbleed(hostname, { peek: true });
      if (!success) return false;
      for (const message of logs) {
        for (const [numerals] of message.matchAll(/\d+/g)) {
          if (numerals.length === details.passwordLength) {
            const result = await authenticate(ns)(hostname, numerals);
            if (result.success) return true;
          }
        }
      }
      return false;
    };
  }
  if (details.passwordHint.startsWith('The password is the largest prime factor of')) {
    let num = +details.data;
    for (let f = 2; f * f <= num; f++) {
      while (num % f === 0) num /= f;
    }
    return recitePassword(num.toString());
  }
  if (details.passwordHint.startsWith("you are one who's'nt authorized")) {
    const password = new Array(details.passwordLength).fill(null);
    let sequence = getSequence(details.passwordFormat);
    return heartbleedSolver(
      ns,
      hostname,
    )(async ({ jsonLogs }) => {
      for (const { data, passwordAttempted } of jsonLogs) {
        if (typeof data === 'string') {
          const correct = data.split(',').map((v) => v === 'yes');
          for (let i = 0; i < correct.length; i++) {
            if (correct[i]) {
              password[i] = passwordAttempted[i];
              sequence = sequence.filter((c) => c !== password[i]);
            }
          }
        }
      }
      const d = sequence.shift();
      if (!d) return null;
      sequence.push(d);
      return password.map((s) => (s == null ? d : s)).join('');
    });
  }
  if (details.passwordHint.startsWith('I accidentally sorted the password: ')) {
    const generator = permutationGenerator(details.data.split(''));
    generator.next(); // Discard first result
    return async () => {
      for (const item of generator) {
        const result = await authenticate(ns)(hostname, item);
        if (result.success) return true;
      }
      return false;
    };
  }
  if (SHUFFLED_PASSWORD.some((text) => details.passwordHint.startsWith(text))) {
    return tryPermutations(permutationGenerator(details.data.split('')));
  }
  if (details.passwordHint.startsWith('XOR mask encrypted password')) {
    return recitePassword(solveXor(details.data));
  }
  if (
    details.passwordHint.startsWith('The password is a number between ') ||
    details.passwordHint.startsWith('The password is between')
  ) {
    return async () => {
      const [h1, h2] = (details.data ?? '').split(',');
      let lower = h1 ? parseInt(h1) || romanToInt(h1) : 0;
      let upper = h2 ? parseInt(h2) || romanToInt(h2) : +'9'.repeat(details.passwordLength);
      while (lower <= upper) {
        const { logs, success } = await ns.dnet.heartbleed(hostname, { peek: true });
        if (!success) return false;
        for (const log of logs) {
          try {
            const { data, passwordAttempted } = JSON.parse(log);
            if (data === 'Lower' || data === 'ALTUS NIMIS') {
              upper = Math.min(upper, +passwordAttempted - 1);
            } else {
              lower = Math.max(lower, +passwordAttempted + 1);
            }
          } catch {}
        }
        const mid = Math.floor((lower + upper) / 2);
        const result = await authenticate(ns)(hostname, mid.toString());
        if (result.success) return true;
      }
      return false;
    };
  }
  if (details.passwordHint.includes("dog's name")) {
    const data = ns.peek(DARKNET_FILES) as Record<string, Record<string, string>>;
    const servers = Object.values(data);
    const possibleDogNames = [
      ...new Set(
        servers.flatMap((server) =>
          Object.entries(server)
            .filter(([filename]) => filename.includes('dog'))
            .flatMap(([, content]) => content.split(/[^a-z]+/)),
        ),
      ),
    ].filter((name) => name.length === details.passwordLength);
    return tryPasswords(...possibleDogNames);
  }
  if (details.passwordHint.includes('password buffer')) {
    return async () => {
      const data = ns.peek(DARKNET_FILES) as Record<string, Record<string, string>>;
      const files = Object.values(data).flatMap((servers) => Object.values(servers));
      const matchingFiles = files.filter((file) => file.includes(hostname));
      for (const file of matchingFiles) {
        const match = file.match(/"([^"]+)"/);
        if (match) {
          const result = await authenticate(ns)(hostname, match[1]);
          if (result.success) return true;
        }
      }
      return false;
    };
  }
  if (details.passwordHint.startsWith('The password is divisible by ')) {
    const max = 10 ** details.passwordLength - 1;
    const divisors = new Set<number>();
    const nonDivisors = new Set<number>();
    let current = 0;
    return heartbleedSolver(
      ns,
      hostname,
    )(async ({ jsonLogs }, shouldYield) => {
      current++;
      for (const { passwordAttempted, data: isDivisible } of jsonLogs) {
        if (isDivisible === 'true') divisors.add(+passwordAttempted);
        else nonDivisors.add(+passwordAttempted);
      }
      while (true) {
        if (current >= max) return null;
        const meetsDivisors = [...divisors].every((d) => current % d === 0);
        const meetsNonDivisors = [...nonDivisors].every((d) => current % d !== 0);
        if (meetsDivisors && meetsNonDivisors) return current.toString();
        current++;
        if (shouldYield()) await ns.sleep(0);
      }
    });
  }
  if (PASSWORD_IS.some((text) => details.passwordHint.startsWith(text))) {
    return recitePassword(details.data || details.passwordHint.split(' ').pop()!);
  }
  return null;
};

const gainAccess = async (ns: NS, hostname: string, details: DarknetServerDetails) => {
  const storedPassword = getPassword(ns)(hostname);
  if (storedPassword != null && (await authenticate(ns)(hostname, storedPassword)).success)
    return true;
  const cracker = getCracker(ns, hostname, details);
  if (cracker == null) {
    ns.print('No password strategy for: ' + hostname);
  } else {
    try {
      return await cracker();
    } catch (error) {
      ns.ui.openTail();
      ns.print('\u001b[38;5;124m' + error);
    }
  }
};

let port = 12289108104000;
const DARKNET_FILES = port++;
const DARKNET_PASSWORDS = port++;
const DARKNET_CACHE_HISTORY = port++;
const DARKNET_CONNECTIONS = port++;

const HELPER_SCRIPTS = {
  MEMORY_REALLOCATION: {
    name: 'ns.dnet.memoryReallocation.ts',
    source: `
      export async function main(ns: NS) {
        const [target] = ns.args as string[];
        await ns.dnet.memoryReallocation(target);
      }` as string,
    ramCost: (ns: NS) => 1.6 + ns.getFunctionRamCost('dnet.memoryReallocation'),
  },
  OPEN_CACHES: {
    name: 'ns.dnet.openCaches.ts',
    source: `
      export async function main(ns: NS) {
        for (const cache of ns.args as string[]) {
          try {
            const result = ns.dnet.openCache(cache);
            ns.writePort(${DARKNET_CACHE_HISTORY}, result);
          } catch {}
        }
      }` as string,
    ramCost: (ns: NS) => 1.6 + ns.getFunctionRamCost('dnet.openCache'),
  },
  GO_PHISHING: {
    name: 'ns.dnet.phishingAttack.ts',
    source: `
      export async function main(ns: NS) {
        await ns.dnet.phishingAttack();
      }` as string,
    ramCost: (ns: NS) => 1.6 + ns.getFunctionRamCost('dnet.phishingAttack'),
  },
  SET_STASIS: {
    name: 'ns.dnet.setStasisLink.ts',
    source: `
      export async function main(ns: NS) {
        const [shouldLink, callback] = ns.args as [boolean, string];
        await ns.dnet.setStasisLink(shouldLink);
        ns.spawn(callback, { spawnDelay: 0 });
      }` as string,
    ramCost: (ns: NS) =>
      1.6 + ns.getFunctionRamCost('dnet.setStasisLink') + ns.getFunctionRamCost('spawn'),
  },
  MOVE: {
    name: 'ns.dnet.induceServerMigration.ts',
    source: `
      export async function main(ns: NS) {
        const [target] = ns.args as string[];
        await ns.dnet.induceServerMigration(target);
      }` as string,
    ramCost: (ns: NS) => 1.6 + ns.getFunctionRamCost('dnet.induceServerMigration'),
  },
} as const;

const getHelperScript =
  (ns: NS, hostname = ns.getHostname()) =>
  (script: (typeof HELPER_SCRIPTS)[keyof typeof HELPER_SCRIPTS]) => {
    if (!ns.read(script.name)) ns.write(script.name, script.source, 'w');
    const ramCost = script.ramCost(ns);
    const ramAvailable = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname);
    const maxThreads = Math.floor(ramAvailable / ramCost);
    return { name: script.name, ramCost, maxThreads };
  };

const getVersion = (script: string) => parseInt(script.split('-v').pop()!) || 0;

type DarknetFiles = Record<string, Record<string, string>>;
const putDarknetFiles = (ns: NS, hostname: string, files: Record<string, string>) => {
  const handle = ns.getPortHandle(DARKNET_FILES);
  if (handle.empty()) {
    handle.write({});
  }
  const data = handle.read() as DarknetFiles;
  data[hostname] = files;
  ns.clearPort(DARKNET_FILES);
  ns.writePort(DARKNET_FILES, data);
};

const getPassword = (ns: NS) => (hostname: string) =>
  (ns.peek(12289108104001)[hostname] as string) ?? null;
const authenticate = (ns: NS) => async (hostname: string, password: string) => {
  const result = await ns.dnet.authenticate(hostname, password);
  const port = ns.getPortHandle(DARKNET_PASSWORDS);
  const passwords = (port.empty() ? {} : port.peek()) as Record<string, string>;
  if (result.success) {
    passwords[hostname] = password;
    port.clear();
    port.write(passwords);
  } else if (passwords[hostname] === password) {
    delete passwords[hostname];
    port.clear();
    port.write(passwords);
  }
  return result;
};

const saveConnections = (ns: NS) => (hostname: string, connections: string[]) => {
  const port = ns.getPortHandle(DARKNET_CONNECTIONS);
  const connectionMap = (port.empty() ? {} : port.peek()) as Record<string, string[]>;
  connectionMap[hostname] = connections;
  port.clear();
  port.write(connectionMap);
};

const checkStorm = (ns: NS) => {
  ns.dnet.unleashStormSeed();
};

const clearBlockages = (ns: NS, hostname = ns.getHostname(), target = hostname) => {
  if (ns.dnet.getBlockedRam(target)) {
    const { name, maxThreads } = getHelperScript(ns, hostname)(HELPER_SCRIPTS.MEMORY_REALLOCATION);
    if (maxThreads) ns.exec(name, hostname, maxThreads, target);
  }
};

const checkCaches = (ns: NS) => {
  const hostname = ns.getHostname();
  const caches = ns.ls(hostname, '.cache');
  if (caches.length) {
    const { name, maxThreads } = getHelperScript(ns)(HELPER_SCRIPTS.OPEN_CACHES);
    if (maxThreads >= 1) ns.exec(name, hostname, 1, ...caches);
  }
};

const stealFiles = (ns: NS) => {
  const filesToSteal = ns.ls(ns.getHostname()).filter((file) => !file.endsWith('.ts'));
  const fileMap = filesToSteal.reduce(
    (map, filename) => {
      map[filename] = ns.read(filename);
      return map;
    },
    {} as Record<string, string>,
  );
  putDarknetFiles(ns, ns.getHostname(), fileMap);
};

const goPhishing = (ns: NS) => {
  const { name, maxThreads } = getHelperScript(ns)(HELPER_SCRIPTS.GO_PHISHING);
  if (maxThreads) ns.exec(name, ns.getHostname(), maxThreads);
};

const setStasis = (ns: NS, shouldLink = true) => {
  if (ns.ps().find((ps) => ps.filename === HELPER_SCRIPTS.SET_STASIS.name)) return;
  const { name, ramCost } = getHelperScript(ns)(HELPER_SCRIPTS.SET_STASIS);
  if (ns.ramOverride(ramCost) !== ramCost) {
    for (const ps of ns.ps()) {
      if (ps.pid !== ns.pid) {
        ns.ui.closeTail(ps.pid);
        ns.kill(ps.pid);
      }
    }
    if (ns.ramOverride(ramCost) !== ramCost) return;
  }
  ns['spawn'](name, { spawnDelay: 0 }, shouldLink, ns.getScriptName());
};

const updateLocks = (ns: NS) => {
  const hostname = ns.getHostname();
  const server = ns.dnet.getServerDetails();
  const depth = ns.dnet.getDepth();
  const stasisLimit = ns.dnet.getStasisLinkLimit();
  const stasisServers = ns.dnet.getStasisLinkedServers();
  const hasStasis = stasisServers.includes(hostname);
  const spotsLeft = stasisLimit - stasisServers.length;

  if (server.isStationary && hasStasis) {
    setStasis(ns, false);
    return;
  }

  if (server.isStationary || stasisLimit === 0 || depth < 1) return;

  const connections = ns.dnet.probe().map(ns.dnet.getServerDetails);
  const adjacentGoal = connections.find(({ modelId }) => modelId === '(The Labyrinth)');

  if (stasisLimit === 1) {
    // Leap-frogging not possible. Just wait until someone gets to the bottom
    const touchingGoal = adjacentGoal != null;
    if (hasStasis && !touchingGoal) {
      setStasis(ns, false);
    } else if (!hasStasis && spotsLeft > 0 && touchingGoal) {
      setStasis(ns, true);
    }
  } else if (stasisServers.length === 0) {
    setStasis(ns, true);
  } else {
    const minStasisDepth = Math.min(...stasisServers.map(ns.dnet.getDepth));
    const maxStasisDepth = Math.max(...stasisServers.map(ns.dnet.getDepth));
    if (hasStasis) {
      if (depth < maxStasisDepth) {
        setStasis(ns, false);
      } else if (depth === minStasisDepth && spotsLeft === 0 && adjacentGoal == null) {
        setStasis(ns, false);
      }
    } else {
      if (depth > maxStasisDepth) {
        setStasis(ns, true);
      } else if (depth === maxStasisDepth && (spotsLeft > 1 || adjacentGoal != null)) {
        setStasis(ns, true);
      }
    }
  }
};

const checkNeighborVersion = (ns: NS, neighbor: string) => {
  const script = ns.getScriptName();
  const scriptRam = ns.getScriptRam(script);
  const reallocRam = HELPER_SCRIPTS.MEMORY_REALLOCATION.ramCost(ns);

  const startScript = () => {
    ns.scp(script, neighbor);
    const blockedRam = ns.dnet.getBlockedRam(neighbor);
    if (blockedRam) {
      // If there is blocked ram, the goal is to get the server self-sufficient
      // as quickly as possible. A server is self sufficient when it can unblock
      // its own RAM while still running mole
      const usableRam = ns.getServerMaxRam(neighbor) - blockedRam;
      if (usableRam >= scriptRam + reallocRam) {
        ns.exec(script, neighbor);
      } else {
        clearBlockages(ns, ns.getHostname(), neighbor);
        clearBlockages(ns, neighbor);
      }
    } else {
      ns.exec(script, neighbor);
    }
  };

  const otherMoles = ns.ps(neighbor).filter((ps) => ps.filename.includes('mole'));
  if (otherMoles.length === 0) {
    startScript();
  } else {
    for (const ps of otherMoles) {
      const version = getVersion(script);
      const otherVersion = getVersion(ps.filename);
      if (version < otherVersion) {
        ns.ui.closeTail(ns.pid);
        ns.exit();
      }
      if (version > otherVersion) {
        ns.ui.closeTail(ps.pid);
        ns.kill(ps.pid);
      }
    }
    if (!ns.ps(neighbor).some((ps) => ps.filename === script)) {
      startScript();
    }
  }
};

const getTargets = (ns: NS) => {
  const connections = ns.dnet.probe();
  saveConnections(ns)(ns.getHostname(), connections);
  return connections.sort((h1, h2) => {
    const s1 = ns.dnet.getServerDetails(h1);
    const s2 = ns.dnet.getServerDetails(h2);
    if (s1.isStationary) return -1;
    if (s2.isStationary) return -1;
    return s1.difficulty - s2.difficulty;
  });
};

export async function main(ns: NS) {
  ns.ui.setTailTitle(`${ns.getScriptName()} (${ns.getHostname()})`);
  while (true) {
    checkStorm(ns);
    clearBlockages(ns);
    checkCaches(ns);
    stealFiles(ns);
    updateLocks(ns);
    for (const hostname of getTargets(ns)) {
      const details = ns.dnet.getServerDetails(hostname);
      if (details.hasSession || (await gainAccess(ns, hostname, details))) {
        checkNeighborVersion(ns, hostname);
      }
    }
    goPhishing(ns);
    await ns.dnet.nextMutation();
  }
}

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
function romanToInt(numeralString: string) {
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
}

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

function* counter(length: number): Generator<number> {
  if (length <= 0) return;
  const max = 10 ** length - 1;
  for (let num = 1; num <= max; num++) {
    yield num;
  }
}

const mastermindSolver = (ns: NS, hostname: string, details: DarknetServerDetails) => async () => {
  type MastermindRule = { password: string; exact: number; wrongPlace: number };
  if (details.passwordLength > 3) {
    return false;
  }
  const rules = [] as MastermindRule[];
  const matches = (password: string, rule: MastermindRule) => {
    const numExact = [...password]
      .map((c, i) => +(c === rule.password[i]))
      .reduce((a, b) => a + b, 0);
    if (numExact !== rule.exact) return false;
    // TODO: make two lists of non matching characters (using filter)
    // and measure what they have in common. If common characters
    // fewer than `wrongPlace` a match isn't possible.
    return true;
  };
  for (const possibleGuess of numeralSequenceGenerator(details.passwordLength)) {
    if (rules.every((rule) => matches(possibleGuess, rule))) {
      const result = await authenticate(ns)(hostname, possibleGuess);
      if (result.success) return true;
      const { logs } = await ns.dnet.heartbleed(hostname, { peek: true });
      for (const log of logs) {
        try {
          const hint = JSON.parse(log);
          const newRule = {
            password: hint.passwordAttempted,
            exact: +hint.data[0],
            wrongPlace: +hint.data[1],
          };
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
        } catch (error) {
          // JSON error
        }
      }
    }
  }
  return false; // Should not happen
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
const PASSWORD_IS = [
  'The secret is ',
  'The password is ',
  'Remember to use ',
  'The key is ',
  'The PIN is ',
  "It's set to ",
];

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

  if (details.passwordLength === 0 || NO_PASSWORD.some((text) => text === details.passwordHint)) {
    return recitePassword('');
  }
  if (details.passwordHint === 'Only a true master may pass') {
    return mastermindSolver(ns, hostname, details);
  }
  if (details.passwordHint === 'Type the numbers to prove you are human') {
    return recitePassword(details.data.replaceAll(/[^0-9]/g, ''));
  }
  if (details.passwordHint.startsWith('The password is the value of the number')) {
    return recitePassword(romanToInt(details.data).toString());
  }
  if (details.passwordHint.match(/password is the base \d+ number [^ ]+ in base 10/)) {
    const [base, number] = details.data.split(',');
    return recitePassword(parseInt(number, +base).toString());
  }
  if (details.passwordHint === 'The password is the evaluation of this expression') {
    if (details.data.match(/^[0-9\+\-\*\/ ]+$/)) {
      return recitePassword(eval(details.data));
    }
  }
  if (DEFAULT_PASSWORD.includes(details.passwordHint) || details.passwordHint.includes('default')) {
    if (details.passwordLength === 0) return recitePassword('');
    if (details.passwordLength === 4) return recitePassword('0000');
    if (details.passwordLength === 5) return tryPasswords('12345', 'admin');
    if (details.passwordLength === 8) return recitePassword('password');
  }

  if (details.passwordHint === "(I'm busy browsing social media at the cafe)") {
    return async () => {
      const { logs } = await ns.dnet.heartbleed(hostname, { peek: true });
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
  if (details.passwordHint.startsWith("you are one who's'nt authorized")) {
    return async () => {
      const password = new Array(details.passwordLength).fill(null);
      for (let d = 0; d <= 9; d++) {
        const digit = d.toString();
        const nextAttempt = password.map((d) => (d == null ? digit : d)).join('');
        const result = await authenticate(ns)(hostname, nextAttempt);
        if (result.success) return true;
        const scrape = await ns.dnet.heartbleed(hostname, { peek: true });
        const hints = scrape.logs.map((text) => {
          try {
            return JSON.parse(text);
          } catch {
            return {};
          }
        });
        for (const { data, passwordAttempted } of hints) {
          if (typeof data === 'string') {
            const correct = data.split(',').map((v) => v === 'yes');
            for (let i = 0; i < correct.length; i++) {
              if (correct[i]) password[i] = passwordAttempted[i];
            }
          }
        }
      }
      return false;
    };
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
  if (
    details.passwordHint.startsWith('The password is shuffled ') ||
    details.passwordHint.startsWith('The PIN uses ')
  ) {
    return async () => {
      for (const item of permutationGenerator(details.data.split(''))) {
        const result = await authenticate(ns)(hostname, item);
        if (result.success) return true;
      }
      return false;
    };
  }
  if (details.passwordHint.startsWith('The password is a number between ')) {
    return async () => {
      let lower = 0;
      let upper = +'9'.repeat(details.passwordLength);
      while (lower <= upper) {
        const { logs } = await ns.dnet.heartbleed(hostname, { peek: true });
        for (const log of logs) {
          try {
            const { data, passwordAttempted } = JSON.parse(log);
            if (data === 'Lower') {
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
    return async () => {
      const data = ns.peek(DARKNET_FILES) as Record<string, Record<string, string>>;
      const possibleDogNames = new Set<string>();
      for (const servers of Object.values(data)) {
        for (const [filename, content] of Object.entries(servers)) {
          if (filename.includes('dog')) {
            for (const name of content.split(/[^a-z]+/)) {
              possibleDogNames.add(name);
            }
          }
        }
      }
      for (const password of possibleDogNames) {
        const result = await authenticate(ns)(hostname, password);
        if (result.success) return true;
      }
    };
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
    const divisors = new Set([1]);
    const nonDivisors = new Set<number>();
    const numbers = counter(details.passwordLength);
    numbers.next();

    const getNextAttempt = () => {
      while (true) {
        const number = numbers.next().value;
        if (number == null) return null;
        const meetsDivisors = [...divisors].every((d) => number % d === 0);
        const meetsNonDivisors = [...nonDivisors].every((d) => number % d !== 0);
        if (meetsDivisors && meetsNonDivisors) return number.toString();
      }
    };
    return async () => {
      while (true) {
        const { logs } = await ns.dnet.heartbleed(hostname);
        for (const log of logs) {
          try {
            const { passwordAttempted, data: isDivisible } = JSON.parse(log);
            if (isDivisible === 'true') divisors.add(+passwordAttempted);
            else nonDivisors.add(+passwordAttempted);
          } catch {}
        }
        const password = getNextAttempt();
        if (password == null) return false;
        const result = await authenticate(ns)(hostname, password);
        if (result.success) return true;
      }
    };
  }
  if (PASSWORD_IS.some((text) => details.passwordHint.startsWith(text))) {
    return recitePassword(details.data || details.passwordHint.split(' ').pop()!);
  }
  return null;
};

const gainAccess = async (ns: NS, hostname: string, details: DarknetServerDetails) => {
  const cracker = getCracker(ns, hostname, details);
  if (cracker == null) {
    ns.print('No password strategy for: ' + hostname);
  } else {
    return cracker();
  }
};

const HELPER_SCRIPTS = {
  MEMORY_REALLOCATION: {
    name: 'ns.dnet.memoryReallocation.ts',
    source: `
      export async function main(ns: NS) {
        await ns.dnet.memoryReallocation();
      }` as string,
    ramCost: (ns: NS) => 1.6 + ns.getFunctionRamCost('dnet.memoryReallocation'),
  },
  OPEN_CACHES: {
    name: 'ns.dnet.openCaches.ts',
    source: `
      export async function main(ns: NS) {
        for (const cache of ns.args as string[])
          ns.dnet.openCache(cache);
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

// const DARKNET_FILES = [...'DARKNET'].map((c)=>c.charCodeAt(0)).reduce((a,b)=>a*b);
const DARKNET_FILES = 12289108104000;
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

const DARKNET_PASSWORDS = DARKNET_FILES + 1;
const authenticate = (ns: NS) => async (hostname: string, password: string) => {
  const result = await ns.dnet.authenticate(hostname, password);
  if (result.success) {
    const port = ns.getPortHandle(DARKNET_PASSWORDS);
    const passwords = (port.empty() ? {} : port.peek()) as Record<string, string>;
    passwords[hostname] = password;
    port.clear();
    port.write(passwords);
  }
  return result;
};

const checkStorm = (ns: NS) => {
  ns.dnet.unleashStormSeed();
};

const clearBlockages = (ns: NS, hostname = ns.getHostname()) => {
  if (ns.dnet.getBlockedRam()) {
    const { name, maxThreads } = getHelperScript(ns, hostname)(HELPER_SCRIPTS.MEMORY_REALLOCATION);
    if (maxThreads) ns.exec(name, ns.getHostname(), maxThreads);
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
        ns.kill(ps.pid);
      }
    }
    if (ns.ramOverride(ramCost) !== ramCost) return;
  }
  ns['spawn'](name, { spawnDelay: 0 }, shouldLink, ns.getScriptName());
};

const updateLocks = (ns: NS) => {
  const hostname = ns.getHostname();
  const stasisServers = ns.dnet.getStasisLinkedServers();
  const depth = ns.dnet.getDepth();
  if (stasisServers.length === 0) {
    if (depth > 0) setStasis(ns, true);
    return;
  }
  const minStasisDepth = Math.min(...stasisServers.map(ns.dnet.getDepth));
  const maxStasisDepth = Math.max(...stasisServers.map(ns.dnet.getDepth));
  const hasStasis = stasisServers.includes(hostname);
  const spotsLeft = ns.dnet.getStasisLinkLimit() - stasisServers.length;
  if (hasStasis) {
    if (depth < maxStasisDepth) {
      setStasis(ns, false);
    } else if (depth === minStasisDepth && spotsLeft === 0) {
      setStasis(ns, false);
    }
  } else {
    if (depth > maxStasisDepth) {
      setStasis(ns, true);
    } else if (depth === maxStasisDepth && spotsLeft > 1) {
      setStasis(ns, true);
    }
  }
};

const checkVersion = (ns: NS, hostname: string) => {
  const script = ns.getScriptName();

  const startScript = () => {
    ns.scp(script, hostname);
    const ramAvailable = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname);
    if (ramAvailable < 10) {
      clearBlockages(ns, hostname);
    } else {
      ns.exec(script, hostname);
    }
  };

  const otherMoles = ns.ps(hostname).filter((ps) => ps.filename.includes('mole'));
  if (otherMoles.length === 0) {
    startScript();
  } else {
    for (const ps of otherMoles) {
      const version = getVersion(script);
      const otherVersion = getVersion(ps.filename);
      if (version > otherVersion) ns.kill(ps.pid);
    }
    if (!ns.ps(hostname).some((ps) => ps.filename === script)) {
      startScript();
    }
  }
};

export async function main(ns: NS) {
  while (true) {
    checkStorm(ns);
    clearBlockages(ns);
    checkCaches(ns);
    stealFiles(ns);
    goPhishing(ns);
    updateLocks(ns);
    for (const hostname of ns.dnet.probe()) {
      const details = ns.dnet.getServerDetails(hostname);
      if (details.hasSession || (await gainAccess(ns, hostname, details))) {
        checkVersion(ns, hostname);
      }
    }
    await ns.dnet.nextMutation();
  }
}

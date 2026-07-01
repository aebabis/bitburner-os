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
      yield numeral + end;
    }
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
    const passwordCounts = new Array(10).fill(0) as number[];
    const ruleCounts = new Array(10).fill(0) as number[];
    for (const c of password) passwordCounts[+c] += 1;
    for (const c of rule.password) ruleCounts[+c] += 1;
    const numSame = passwordCounts
      .map((count, i) => Math.min(count, ruleCounts[i]))
      .reduce((a, b) => a + b);
    if (numSame - numExact !== rule.wrongPlace) return false;
    return true;
  };
  for (const possibleGuess of numeralSequenceGenerator(details.passwordLength)) {
    if (rules.every((rule) => matches(possibleGuess, rule))) {
      const result = await ns.dnet.authenticate(hostname, possibleGuess);
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
    return (await ns.dnet.authenticate(hostname, password)).success;
  };
  const tryPasswords =
    (...passwords: string[]) =>
    async () => {
      for (const password of passwords) {
        if (ns.dnet.connectToSession(hostname, password).success) return true;
        if ((await ns.dnet.authenticate(hostname, password)).success) return true;
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
            const result = await ns.dnet.authenticate(hostname, numerals);
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
        const result = await ns.dnet.authenticate(hostname, nextAttempt);
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
        const result = await ns.dnet.authenticate(hostname, item);
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
        const result = await ns.dnet.authenticate(hostname, item);
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
        const result = await ns.dnet.authenticate(hostname, mid.toString());
        if (result.success) return true;
      }
      return false;
    };
  }
  if (PASSWORD_IS.some((text) => details.passwordHint.startsWith(text))) {
    return recitePassword(details.data || details.passwordHint.split(' ').pop()!);
  }
  return null;
};

const authenticate = async (ns: NS, hostname: string, details: DarknetServerDetails) => {
  const cracker = getCracker(ns, hostname, details);
  if (cracker == null) {
    ns.print('No password strategy for: ' + hostname);
  } else {
    return cracker();
  }
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

export async function main(ns: NS) {
  const caches = ns.ls(ns.getHostname(), '.cache');
  for (const cache of caches) {
    ns.dnet.openCache(cache);
  }
  const filesToSteal = ns.ls(ns.getHostname()).filter((file) => !file.endsWith('.ts'));
  const fileMap = filesToSteal.reduce(
    (map, filename) => {
      map[filename] = ns.read(filename);
      return map;
    },
    {} as Record<string, string>,
  );
  putDarknetFiles(ns, ns.getHostname(), fileMap);

  while (true) {
    const connections = ns.dnet.probe();
    for (const hostname of connections) {
      const details = ns.dnet.getServerDetails(hostname);
      if (details.hasSession || (await authenticate(ns, hostname, details))) {
        const otherMoles = ns.ps(hostname).filter((ps) => ps.filename.includes('mole'));
        if (otherMoles.length === 0) {
          ns.scp(ns.getScriptName(), hostname);
          ns.exec(ns.getScriptName(), hostname);
        } else {
          for (const ps of otherMoles) {
            const version = getVersion(ns.getScriptName());
            const otherVersion = getVersion(ps.filename);
            if (version < otherVersion) return;
            if (version > otherVersion) {
              ns.kill(ps.pid);
              if (ns.isRunning(ns.getScriptName(), hostname)) {
                ns.scp(ns.getScriptName(), hostname);
                ns.exec(ns.getScriptName(), hostname, 1, ns.args[0]);
              }
            }
          }
        }
      }
      await ns.dnet.heartbleed(hostname);
    }
    await ns.dnet.nextMutation();
  }
}

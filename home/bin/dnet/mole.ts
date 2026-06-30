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

const getPassword = (details: DarknetServerDetails) => {
  if (details.passwordLength === 0) return '';

  if (details.passwordHint === 'Type the numbers to prove you are human') {
    return details.data.replaceAll(/[^0-9]/g, '');
  }

  if (details.passwordHint.startsWith('The password is the value of the number')) {
    return romanToInt(details.data).toString();
  }

  if (details.passwordHint.match(/password is the base \d+ number [^ ]+ in base 10/)) {
    const [base, number] = details.data.split(',');
    return parseInt(number, +base).toString();
  }

  if (DEFAULT_PASSWORD.includes(details.passwordHint) || details.passwordHint.includes('default')) {
    if (details.passwordLength === 0) return '';
    if (details.passwordLength === 4) return '0000';
    if (details.passwordLength === 5) return Math.random() < 0.5 ? '12345' : 'admin';
    if (details.passwordLength === 8) return 'password';
  }

  if (PASSWORD_IS.some((text) => details.passwordHint.startsWith(text))) {
    return details.data || details.passwordHint.split(' ').pop()!;
  }
  if (NO_PASSWORD.includes(details.passwordHint)) {
    return '';
  }
  return null;
};

const crackPassword = async (ns: NS, hostname: string, details: DarknetServerDetails) => {
  if (details.passwordHint.startsWith("you are one who's'nt authorized")) {
    const password = new Array(details.passwordLength).fill(null);
    for (let d = 0; d <= 9; d++) {
      const digit = d.toString();
      const nextAttempt = password.map((d) => (d == null ? digit : d)).join('');
      const result = await ns.dnet.authenticate(hostname, nextAttempt);
      if (result.success) return true;
      const scrape = await ns.dnet.heartbleed(hostname, { peek: true });
      const hints = scrape.logs.map((text) => JSON.parse(text));
      for (const { data, passwordAttempted } of hints) {
        if (typeof data === 'string') {
          const correct = data.split(',').map((v) => v === 'yes');
          for (let i = 0; i < correct.length; i++) {
            if (correct[i]) password[i] = passwordAttempted[i];
          }
        }
      }
    }
  } else if (details.passwordHint.startsWith('I accidentally sorted the password: ')) {
    const generator = permutationGenerator(details.data.split(''));
    generator.next(); // Discard first result
    for (const item of generator) {
      const result = await ns.dnet.authenticate(hostname, item);
      if (result.success) return true;
    }
    return false;
  } else if (details.passwordHint.startsWith('The password is shuffled ')) {
    for (const item of permutationGenerator(details.data.split(''))) {
      const result = await ns.dnet.authenticate(hostname, item);
      if (result.success) return true;
    }
    return false;
  } else {
    ns.print('No password strategy for: ' + hostname);
    return false;
  }
};

const authenticate = async (ns: NS, hostname: string, details: DarknetServerDetails) => {
  if (details.passwordHint.startsWith('The password is shuffled')) {
    return await crackPassword(ns, hostname, details);
  }
  const password = getPassword(details);
  if (password == null) {
    return await crackPassword(ns, hostname, details);
  } else {
    if (ns.dnet.connectToSession(hostname, password).success) {
      ns.print(`${hostname}: "${password}", (reconnected)`);
      return true;
    } else {
      const result = await ns.dnet.authenticate(hostname, password);
      if (result.success) {
        ns.print(`${hostname}: "${password}", (connected)`);
        return true;
      } else {
        ns.print(`ERROR${hostname}: "${password}", (failed)`);
        return false;
      }
    }
  }
};

const getVersion = (script: string) => parseInt(script.split('-v').pop()!) || 0;

export async function main(ns: NS) {
  const caches = ns.ls(ns.getHostname(), '.cache');
  for (const cache of caches) {
    ns.dnet.openCache(cache);
  }
  if (ns.getHostname() === 'darkweb') {
    ns.disableLog('ALL');
    ns.ui.openTail();
    ns.ui.moveTail(250, 2);
    ns.ui.resizeTail(700, 500);
    // ns.print('labreport');
    // ns.print(await ns.dnet.labreport());
    // ns.print('labrader');
    // ns.print(await ns.dnet.labradar());
  }

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

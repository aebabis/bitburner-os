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

const NO_PASSWORD = ['There is no password', 'The password is not set', 'The PIN is empty'];
const DEFAULT_PASSWORD = [
  'I never changed the password',
  'The default password is set',
  "It's still the factory settings",
  "It's still the default",
];
const PASSWORD_IS = ['The secret is', 'The password is', 'Remember to use'];

const getPassword = (details: DarknetServerDetails) => {
  if (PASSWORD_IS.some((text) => details.passwordHint.startsWith(text))) {
    return details.data;
  }
  if (NO_PASSWORD.includes(details.passwordHint)) {
    return '';
  }
  if (DEFAULT_PASSWORD.includes(details.passwordHint)) {
    if (details.passwordLength === 0) return '';
    if (details.passwordLength === 4) return '0000';
    if (details.passwordLength === 5) return 'admin';
    if (details.passwordLength === 8) return 'password';
  }
  if (details.passwordHint === 'Type the numbers to prove you are human') {
    return details.data.replaceAll(/[^0-9]/g, '');
  }
  if (details.passwordHint.startsWith('The password is the value of the number')) {
    return romanToInt(details.data).toString();
  }
  return null;
};

const authenticate = async (ns: NS, hostname: string, details: DarknetServerDetails) => {
  const password = getPassword(details);
  if (password) {
    if (ns.dnet.connectToSession(hostname, password)) return true;
    const result = await ns.dnet.authenticate(hostname, password);
    return result.success;
  }
};

export async function main(ns: NS) {
  const caches = ns.ls(ns.getHostname(), '.cache');
  for (const cache of caches) {
    ns.tprint(ns.dnet.openCache(cache));
  }
  if (ns.getHostname() === 'darkweb') {
    // ns.ui.openTail();
    // ns.ui.moveTail(250, 2);
    // ns.ui.resizeTail(700, 500);
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
        for (const ps of ns.ps(hostname)) {
          if (ns.args[0] > (ps.args[0] ?? 0)) ns.kill(ps.pid);
        }
        ns.scp(ns.ls(ns.getHostname(), '/bin/dnet/'), hostname);
        ns.exec('/bin/dnet/mole.ts', hostname);
      }
      await ns.dnet.heartbleed(hostname);
    }
    await ns.dnet.nextMutation();
  }
}

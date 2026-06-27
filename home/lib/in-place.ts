type Asyncify<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : T[K] extends object
      ? Asyncify<T[K]>
      : T[K];
};

const getApiProgram = (apiPath: string) => `
export async function main(ns: NS) {
  const args = ns.readPort(ns.args[0]);
  let result;
  try {
    result = await ns.${apiPath}(...args);
  } catch (error) {
    result = error;
  }
  ns.atExit(() => {
    try {
      ns.writePort(ns.args[0], result);
    } catch (error) {
      ns.writePort(ns.args[0], error);
    }
  });
}`;

const getFunctionProgram = (func: () => unknown) => {
  const body = func
    .toString()
    .replaceAll(/(ns[A-Za-z\.]*)\['([^']*)']/g, (_str, match1, match2) => `${match1}.${match2}`);
  return `
export async function main(ns: NS) {
  const args = ns.readPort(ns.args[0]);
  let result;
  try {
    result = await (${body})(...args);
  } catch (error) {
    result = error;
  }
  ns.atExit(() => {
    try {
      ns.writePort(ns.args[0], result);
    } catch (error) {
      ns.writePort(ns.args[0], error);
    }
  });
}`;
};

const sdbm = (str: string) => {
  let hashCode = 0;
  for (let i = 0; i < str.length; i++) {
    hashCode = str.charCodeAt(i) + (hashCode << 6) + (hashCode << 16) - hashCode;
  }
  return hashCode;
};

const getScript = (ns: NS) => (apiPath: string) => {
  const script = `tmp/bin/${apiPath}.ts`;
  if (!ns.read(script)) {
    ns.write(script, getApiProgram(apiPath), 'w');
  }
  return script;
};

const getBodyScript = (ns: NS) => (func: () => unknown) => {
  const hash = sdbm(func.toString());
  const script = `tmp/bin/rip-${hash}.ts`;
  if (!ns.read(script)) {
    ns.write(script, getFunctionProgram(func), 'w');
    const ram = ns.getScriptRam(script);
    if (ram === 0) {
      throw new Error('runInPlace callback contains illegal or unsupported syntax');
    }
  }
  return script;
};

const runScript =
  (ns: NS, port: number) =>
  async (script: string, ...args: ScriptArg[]) => {
    const ram = ns.getScriptRam(script);
    const startingRam = ns.ramOverride();
    const desiredNewRam = +(startingRam - ram).toFixed(2);
    const newRam = +ns.ramOverride(desiredNewRam);
    if (newRam === startingRam) {
      throw new Error(
        `Failed to shrink from ${startingRam}GB to ${desiredNewRam}GB for ${script}. ` +
          "Make sure you've reserved RAM for the most expensive call",
      );
    }
    ns.writePort(port, args);
    const pid = ns.run(script, 1, port);
    if (!pid) {
      throw new Error('This should never happen');
    }
    await ns.nextPortWrite(port);
    const restoredRam = ns.ramOverride(startingRam);
    if (restoredRam !== startingRam) {
      throw new Error('Failed to restore RAM from ' + restoredRam + ' to ' + startingRam);
    }
    const result = ns.readPort(port);
    if (result === 'NULL PORT DATA') {
      throw new Error('No data in port after running helper program');
    }
    if (!ns.getPortHandle(port).empty()) {
      const data = ns.peek(port);
      ns.clearPort(port);
      throw new Error('Port ' + port + ' not empty after read: ' + data);
    }
    if (result instanceof Error) {
      throw result;
    } else {
      return result;
    }
  };

const getProxy =
  (ns: NS, port: number) =>
  <T extends Object>(obj: T, ...path: (string | symbol)[]) =>
    new Proxy(obj, {
      get(namespace: T, prop) {
        const value = namespace[prop as keyof T];
        if (typeof value === 'function') {
          const apiPath = [...path, prop].map((p) => p.toString()).join('.');
          if (ns.getFunctionRamCost(apiPath) === 0) {
            // Don't make scripts for free APIs
            return value;
          }
          const script = getScript(ns)(apiPath);
          return async (...args: ScriptArg[]) => runScript(ns, port)(script, ...args);
        } else if (value instanceof Object) {
          return getProxy(ns, port)(value, ...path, prop);
        } else {
          return namespace[prop as keyof T];
        }
      },
    }) as Asyncify<T>;

const portMap: Record<string, number> = {};

const getPort = (id: string) => {
  if (!portMap[id]) {
    portMap[id] = 1 + Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  }
  return portMap[id];
};

/**
 * Creates an adapter for the NS namespace whose functions share RAM in a program.
 * Adapter's functions are asyncronous because they run in a separate
 * process. Everything else works the same.
 * To use in a program, reserve RAM for the most expensive function used
 * by the library.
 * @example
 * ```ts
 * typeof ns.cloud.purchaseServer // Most expensive
 * // Square brackets on all functions sharing RAM
 * const server = inPlace(ns)\['getServer'\]('mycloud-1');
 * if (server) {
 *   await inPlace(ns)\['upgradeServer'\]('mycloud-1', server.maxRam * 2);
 * } else {
 *   await inPlace(ns)\['buyServer'\]('mycloud-1');
 * }
 * ```
 */
export const inPlace = (ns: NS, port = getPort(ns.getScriptName())): Asyncify<NS> =>
  getProxy(ns, port)(ns);

export const runInPlace =
  (ns: NS, port = getPort(ns.getScriptName())) =>
  <F extends (...args: any[]) => any>(action: F) =>
  (...args: Parameters<F>): Promise<ReturnType<F>> => {
    const script = getBodyScript(ns)(action);
    return runScript(ns, port)(script, ...args) as Promise<ReturnType<F>>;
  };

// Reserves 1.6 GB of RAM so that ramOverride can give it to
// run processes. Assumes your program will not call these (without the use of inPlace)
typeof heartbleed;
typeof hackAnalyzeThreads;

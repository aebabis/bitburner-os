type Asyncify<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : T[K] extends object
      ? Asyncify<T[K]>
      : T[K];
};

const getApiProgram = (apiPath: string) => `
export async function main(ns: NS) {
  let result;
  try {
    result = ns.${apiPath}(...JSON.parse(ns.args[1]));
  } catch (error) {
    result = error;
  }
  ns.atExit(() => {
    ns.writePort(ns.args[0], result);
  });
}`;

const getScript = (ns: NS) => (path: string[]) => {
  const apiPath = path.join('.');
  const script = `tmp/bin/${apiPath}.ts`;
  if (!ns.read(script)) {
    ns.write(script, getApiProgram(apiPath), 'w');
  }
  const functionRam = ns.getFunctionRamCost(apiPath);
  return {
    script,
    baseRam: functionRam,
    ram: 1.6 + functionRam,
  };
};

const getProxy =
  (ns: NS, port: number) =>
  <T extends Object>(obj: T, ...path: (string | symbol)[]) =>
    new Proxy(obj, {
      get(namespace: T, prop) {
        const value = namespace[prop as keyof T];
        if (typeof value === 'function') {
          const { script, ram, baseRam } = getScript(ns)([...path, prop].map((p) => p.toString()));
          if (baseRam === 0) {
            // Don't make scripts for free APIs
            return value;
          }
          return async (...args: ScriptArg[]) => {
            const startingRam = ns.ramOverride();
            const newRam = ns.ramOverride(startingRam - ram);
            if (newRam === startingRam) {
              throw new Error(
                'Failed to shrink from ' +
                  startingRam +
                  ' to ' +
                  (startingRam - ram) +
                  ". Make sure you've reserved an additional base script cost (1.6GB)",
              );
            }
            const pid = ns.run(script, 1, port, JSON.stringify(args));
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
              throw new Error('Port ' + port + ' not empty after read: ' + ns.peek(port));
            }
            if (result instanceof Error) {
              throw result;
            } else {
              return result;
            }
          };
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

// Reserves 1.6 GB of RAM so that ramOverride can give it to
// run processes. Assumes your program will not call these (without the use of inPlace)
typeof heartbleed;
typeof hackAnalyzeThreads;

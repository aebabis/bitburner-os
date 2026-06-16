type Asyncify<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : T[K] extends object
      ? Asyncify<T[K]>
      : T[K];
};

const getApiProgram = (apiPath: string) => `
export async function main(ns: NS) {
  const result = ns.${apiPath}(...JSON.parse(ns.args[1]));
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
                'Failed to shrink from ' + startingRam + ' to ' + (startingRam - ram),
              );
            }
            const pid = ns.run(script, 1, port, JSON.stringify(args));
            if (!pid) {
              throw new Error('This error is the least likely');
            }
            await ns.nextPortWrite(port);
            const restoredRam = ns.ramOverride(startingRam);
            if (restoredRam !== startingRam) {
              throw new Error('Failed to restore RAM from ' + restoredRam + ' to ' + startingRam);
            }
            return ns.readPort(port);
          };
        } else if (value instanceof Object) {
          return getProxy(ns, port)(value, ...path, prop);
        } else {
          return namespace[prop as keyof T];
        }
      },
    }) as Asyncify<T>;

const randPort = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

export const inPlace = (ns: NS, port = randPort): Asyncify<NS> => getProxy(ns, port)(ns);

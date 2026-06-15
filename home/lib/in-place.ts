type Asyncify<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : T[K] extends object
      ? Asyncify<T[K]>
      : T[K];
};

const getScript = (ns: NS) => (path: string[]) => {
  const apiPath = path.join('.');
  const script = `tmp/bin/${apiPath}.ts`;
  if (!ns.read(script)) {
    ns.write(
      script,
      `export async function main(ns: NS) {\n  ns.writePort(ns.args[0], ns.${apiPath}(...ns.args.slice(1)));\n}`,
      'w',
    );
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
            ns.ramOverride(startingRam - ram);
            ns.run(script, 1, port, ...args);
            await ns.sleep(0);
            ns.ramOverride(startingRam);
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

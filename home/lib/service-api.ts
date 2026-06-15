import Ports from './ports';
import { PORT_SERVICES_LIST, PORT_SERVICES_REPL } from '../etc/ports';
import { table } from './table';

export const DISABLE = 'DISABLE';
export const ENABLE = 'ENABLE';

type ServiceData = {
  id: number | string;
  name: string;
  script: string;
  status: string;
  isRunning: boolean;
  allowed: boolean;
  pid: number;
  desc: string;
  ram: number;
  overhead: number;
};

const getServiceName = (script: string) => script.split('/').pop()?.split('.').shift();

export const getTableString = (ns: NS, taskData: ServiceData[]) => {
  return table(
    ns,
    ['ID', 'NAME', '', 'PID', 'DESC'],
    taskData.map(({ id, name, status, pid, desc }) => [id, name, status, pid, desc]),
  );
};

export const getServices = (ns: NS): ServiceData[] => {
  return Ports(ns).getPortHandle(PORT_SERVICES_LIST).peek();
};

export const disableService = async (ns: NS, idOrName = getServiceName(ns.getScriptName())) => {
  await Ports(ns).getPortHandle(PORT_SERVICES_REPL).blockingWrite({
    identifier: idOrName,
    type: DISABLE,
  });
};

export const enableService = async (ns: NS, idOrName: string | number, override = false) => {
  await Ports(ns).getPortHandle(PORT_SERVICES_REPL).blockingWrite({
    identifier: idOrName,
    type: ENABLE,
    override,
  });
  // TODO: Await response?
};

export const writeServices = (ns: NS, services: ServiceData[]) => {
  const handle = Ports(ns).getPortHandle(PORT_SERVICES_LIST);
  handle.clear();
  handle.write(services);
};

export const checkQueue = (ns: NS) => {
  const port = Ports(ns).getPortHandle(PORT_SERVICES_REPL);
  const tasks = [];
  while (!port.empty()) {
    tasks.push(port.read());
  }
  return tasks;
};

declare global {
  var __spawnChains: Record<string, SpawnChain>;
}
export {};

type SpawnChain = {
  chain: Set<string>;
  maxRam: number;
};

const getSpawnChain = (ns: NS, startScript = ns.getScriptName()): SpawnChain => {
  if (globalThis.__spawnChains[startScript] == null) {
    const chain = new Set([startScript.replace(/^\//, '')]);
    for (const script of chain) {
      const spawnCalls = ns.read(script).matchAll(/linkTo\('([^']+)'/g);
      for (const [, script] of spawnCalls) chain.add(script.replace(/^\//, ''));
    }
    const scriptRam = [...chain].map((script) => ns.getScriptRam(script));
    globalThis.__spawnChains[startScript] = {
      chain,
      maxRam: Math.max(...scriptRam) + ns.getFunctionRamCost('spawn'),
    };
  }
  return globalThis.__spawnChains[startScript];
};

export const readSpawnChain = (ns: NS, startScript: string) => {
  if (globalThis.__spawnChains == null) {
    globalThis.__spawnChains = {};
  }
  delete globalThis.__spawnChains[startScript];
  return getSpawnChain(ns, startScript);
};

export const joinSpawnChain = (ns: NS, startScript = ns.getScriptName()) => {
  const script = ns.getScriptName();
  const { chain, maxRam } = getSpawnChain(ns);
  if (!chain.has(script)) {
    throw new Error(`${script} tried to join script chain for ${startScript}`);
  }
  if (ns.ramOverride(maxRam) !== maxRam) {
    throw new Error(`${script} tried to join ${maxRam}GB chain without extra RAM reserved`);
  }
  return {
    linkTo: async (nextScript: string, timeout = 100, ...args: ScriptArg[]) => {
      await ns.sleep(timeout);
      ns['spawn'](nextScript, { spawnDelay: 0 }, ...args);
    },
  };
};

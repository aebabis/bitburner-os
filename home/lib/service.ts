import { execOnBestServer } from './ram-router';
import { getServices } from './service-api.ts';
import { getStaticData } from './data-store';
import { ERROR, WARN, C } from './colors';

const getExistingPid = (ns: NS, desc: string) => {
  try {
    const services = getServices(ns);
    if (services != null) return services.find((service) => service.desc === desc)?.pid ?? null;
  } catch (error) {
    ns.tprint(error);
  }
};

let count = 1;

interface ServiceOptions {
  interval?: number;
  isChain?: boolean;
  temporary?: boolean;
}

export const Service =
  (
    ns: NS,
    isViable = () => true,
    condition = (_ns: NS) => true,
    { interval = 5000, temporary = true }: ServiceOptions = {},
  ) =>
  (script: string, target: string | null = null, numThreads = 1, ...args: ScriptArg[]) => {
    const id = count++;
    const desc =
      target == null
        ? [script, numThreads, ...args].join(' ')
        : [script, target, numThreads, ...args].join(' ');
    const shortname = script.split('/').pop()?.split('.')[0] ?? '';
    const ram = getStaticData(ns).scriptRam[script.replace(/^[/]/, '')];
    const isPlanner = script.includes(ns.getScriptName());
    let pid = isPlanner ? ns.pid : getExistingPid(ns, desc) || null;
    let lastStart = 0;
    let enabled = true;

    const isRunning = () => !!(pid && ns.isRunning(pid));
    const mayRun = () => enabled && condition(ns);

    const lastRunning = () => (isRunning() ? (lastStart = Date.now()) : lastStart);
    const timeSinceRun = () => Date.now() - lastRunning();

    const enable = () => {
      enabled = true;
    };
    const disable = () => (enabled = false);

    const stop = () => {
      if (pid) {
        ns.kill(pid);
      }
      pid = null;
    };

    const statusCode = () => {
      if (!enabled) return ERROR('⊗');
      else if (isRunning()) return C(34)('●');
      else if (mayRun() && timeSinceRun() > interval) return WARN('○');
      else return '○';
    };

    const check = async () => {
      const running = isRunning();
      const shouldBe = mayRun();
      if (!running && shouldBe && timeSinceRun() > interval) {
        const { pid: newPid } = execOnBestServer(
          ns,
          script,
          target,
          { threads: numThreads, temporary },
          false,
          args,
        );
        pid = newPid || null;
        if (pid) {
          lastStart = Date.now();
        }
      } else if (running && !shouldBe) {
        stop();
      }
    };

    const matches = (identifier: string | number) => identifier == id || identifier === shortname;
    const toData = () => ({
      id,
      name: shortname,
      script,
      status: statusCode(),
      isRunning: isRunning(),
      allowed: enabled && condition(ns),
      pid,
      desc,
      ram,
    });

    const pendingRam = () => {
      if (isRunning() || !enabled || !condition(ns)) return 0;
      return ram;
    };

    return {
      isRunning,
      check,
      getPid: () => pid,
      script,
      isViable,
      toData,
      pendingRam,
      toString,
      enable,
      disable,
      stop,
      matches,
      statusCode,
    };
  };

export const AnyHostService =
  (ns: NS, isViable = () => true, condition = () => true, options?: ServiceOptions) =>
  (script: string, numThreads = 1, ...args: ScriptArg[]) =>
    Service(ns, isViable, condition, options)(script, null, numThreads, ...args);

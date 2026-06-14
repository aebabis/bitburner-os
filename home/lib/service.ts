import { execOnBestServer } from './ram-router';
import { getServices } from './service-api.ts';
import { getStaticData } from './data-store';
import { ERROR, WARN, C } from './colors';

const getExistingPid = (ns: NS, desc: string) => {
  try {
    const services = getServices(ns);
    if (services != null)
      return services.find((service) => service.desc === desc)?.pid;
  } catch (error) {
    ns.tprint(error);
  }
};

export type PoolContext = {
  freePool: number;
  poolReserve: number;
};

let count = 1;
const MAX_INTERVAL = 60_000;

export const Service =
  (
    ns: NS,
    condition = (_ns: NS) => true,
    interval = 5000,
    isViable = () => true,
  ) =>
  (
    script: string,
    target: string | null = null,
    numThreads = 1,
    ...args: ScriptArg[]
  ) => {
    const id = count++;
    const desc =
      target == null
        ? [script, numThreads, ...args].join(' ')
        : [script, target, numThreads, ...args].join(' ');
    const shortname = script.split('/').pop()?.split('.')[0] ?? '';
    const ram = getStaticData(ns).scriptRam[script.replace(/^[/]/, '')];
    let pid = getExistingPid(ns, desc);
    let lastRun = 0;
    let enabled = true;
    let queued = false;
    let currentInterval = interval;

    const isRunning = () => pid && ns.isRunning(pid);

    const enable = () => {
      enabled = true;
      currentInterval = interval;
    };
    const disable = () => (enabled = false);

    const stop = () => {
      ns.kill(pid);
      pid = null;
      currentInterval = interval;
    };

    const statusCode = () => {
      if (!enabled) return ERROR('⊗');
      else if (queued) return '△';
      else if (isRunning()) return C(34)('●');
      else if (currentInterval > interval) return WARN('○');
      else return '○';
    };

    const check = async (beforeRun?: () => void, poolContext?: PoolContext) => {
      const running = isRunning();
      const shouldBe = enabled && condition(ns);
      if (running) currentInterval = interval;
      if (!running && shouldBe) {
        const now = Date.now();
        if (now - lastRun >= currentInterval) {
          const overhead = getStaticData(ns).serviceOverhead[script] ?? 0;
          if (overhead > 0 && poolContext != null) {
            const available = poolContext.freePool - poolContext.poolReserve;
            if (available < overhead) {
              lastRun = now;
              currentInterval = Math.min(currentInterval * 2, MAX_INTERVAL);
              return;
            }
          }
          lastRun = now;
          queued = true;
          if (beforeRun) beforeRun();
          try {
            const { pid: newPid } = execOnBestServer(
              ns,
              script,
              target,
              numThreads,
              false,
              args,
            );
            pid = newPid || undefined;
            if (!pid) {
              ns.tprint(ERROR + 'Failed to start ' + desc);
              currentInterval = Math.min(currentInterval * 2, MAX_INTERVAL);
            }
          } finally {
            queued = false;
          }
        }
      } else if (running && !shouldBe) {
        stop();
      }
    };

    const matches = (identifier: string | number) =>
      identifier == id || identifier === shortname;
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
      overhead: getStaticData(ns).serviceOverhead[script] ?? 0,
    });

    return {
      isRunning,
      check,
      getPid: () => pid,
      script,
      isViable,
      toData,
      toString,
      enable,
      disable,
      stop,
      matches,
      statusCode,
    };
  };

export const AnyHostService =
  (
    ns: NS,
    condition: () => boolean = () => true,
    interval = 5000,
    isViable = () => true,
  ) =>
  (script: string, numThreads = 1, ...args: ScriptArg[]) =>
    Service(ns, condition, interval, isViable)(
      script,
      null,
      numThreads,
      ...args,
    );

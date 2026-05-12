import { delegate } from "./scheduler-delegate.js";
import { getServices } from "./service-api.js";
import { getStaticData } from './data-store';
import { ERROR, C } from "./colors";

/** @param {NS} ns @param {string} desc */
const getExistingPid = (ns, desc) => {
  try {
    const services = getServices(ns);
    if (services != null)
      return services.find((/** @type {{desc: string, pid: number}} */ service) => service.desc === desc)?.pid;
  } catch (error) {
    ns.tprint(error);
  }
};

let count = 1;

/** @param {NS} ns */
const Service =
  (ns, /** @type {(ns: NS) => boolean} */ condition = () => true, /** @type {number} */ interval = 5000) =>
  (/** @type {string} */ script, target = null, /** @type {number} */ numThreads = 1, /** @type {ScriptArg[]} */ ...args) => {
    const id = count++;
    const desc =
      target == null
        ? [script, numThreads, ...args].join(" ")
        : [script, target, numThreads, ...args].join(" ");
    const shortname = script.split("/").pop()?.split(".")[0] ?? '';
    const ram = getStaticData(ns).scriptRam[script.replace(/^[/]/, '')];
    let pid = getExistingPid(ns, desc);
    let lastRun = 0;
    let enabled = true;
    let queued = false;

    const isRunning = () => pid && ns.isRunning(pid);

    const enable = () => (enabled = true);
    const disable = () => (enabled = false);

    const stop = () => {
      ns.kill(pid);
      pid = null;
    };

    const statusCode = () => {
      if (!enabled) return ERROR("⊗");
      else if (queued) return "△";
      else if (isRunning()) return C(34)("●");
      else return "○";
    };

    const check = async (/** @type {(() => void) | undefined} */ beforeRun = undefined) => {
      const running = isRunning();
      const shouldBe = enabled && condition(ns);
      if (!running && shouldBe) {
        const now = Date.now();
        const isReady = now - lastRun >= interval;
        if (isReady) {
          lastRun = now;
          queued = true;
          if (beforeRun) beforeRun();
          try {
            const handle = await delegate(ns, true)(
              script,
              target,
              numThreads,
              ...args,
            );
            pid = handle.pid;
            if (pid == null) ns.tprint(ERROR + "Failed to start " + desc);
          } catch (error) {
            pid = null;
            throw error;
          } finally {
            queued = false;
          }
        }
      } else if (running && !shouldBe) {
        stop();
      }
    };

    const matches = (/** @type {string | number} */ identifier) =>
      identifier == id || identifier === shortname;
    const toData = () => ({
      id,
      name: shortname,
      status: statusCode(),
      pid,
      desc,
      ram,
    });

    return {
      isRunning,
      check,
      getPid: () => pid,
      toData,
      toString,
      enable,
      disable,
      stop,
      matches,
      statusCode,
    };
  };

/** @param {NS} ns */
export const AnyHostService =
  (ns, /** @type {(ns: NS) => boolean} */ condition = () => true, /** @type {number} */ interval = 5000) =>
  (/** @type {string} */ script, /** @type {number} */ numThreads = 1, /** @type {ScriptArg[]} */ ...args) =>
    Service(ns, condition, interval)(script, null, numThreads, ...args);

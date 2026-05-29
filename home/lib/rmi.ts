import { logger } from './logger';
import { delegateAny } from './scheduler-delegate';

/** @param {NS} ns */
export const rmi =
  (ns, retry = false) =>
  async (/** @type {[string, number?, ...ScriptArg[]]} */ ...args) => {
    while (true) {
      try {
        const highPriority = true;
        const { pid } = await delegateAny(ns, true, { highPriority })(...args);
        if (pid) {
          while (ns.isRunning(pid)) await ns.sleep(50);
          return true;
        }
      } catch (error) {
        if (error?.name === 'ScriptDeath') throw error;
        logger(ns).error(error);
        if (!retry) return false;
      }
    }
  };

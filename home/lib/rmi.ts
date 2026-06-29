import { delegateAny } from './scheduler-delegate';

export const rmi =
  (ns: NS, retry = false) =>
  async (...args: [string, number?, ...ScriptArg[]]) => {
    while (true) {
      try {
        const highPriority = true;
        const { pid } = await delegateAny(ns, true, { highPriority })(...args);
        if (pid) {
          while (ns.isRunning(pid)) await ns.sleep(50);
          return true;
        }
      } catch (error) {
        if (error instanceof Error && error?.name === 'ScriptDeath') throw error;
        if (!retry) return false;
      }
    }
  };

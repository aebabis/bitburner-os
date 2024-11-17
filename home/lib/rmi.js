import { logger } from '/lib/logger';
import { delegateAny } from '/lib/scheduler-delegate';

/** @param {NS} ns */
export const rmi = (ns, retry) => async(...args) => {
    while (true) {
        try {
            const highPriority = true;
            const { pid } = await delegateAny(ns, true, { highPriority })(...args);
            if (pid) {
                while (ns.isRunning(pid))
                    await ns.sleep(50);
                return true;
            }
        } catch (error) {
            logger(ns).error(error);
            if (!retry)
                return false;
        }
    }
};

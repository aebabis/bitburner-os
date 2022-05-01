import { logger } from './lib/logger';
import { delegateAny } from './lib/scheduler-delegate';

/** @param {NS} ns */
export const rmi = (ns, retry) => async(...args) => {
    while (true) {
        try {
            const { pid } = await delegateAny(ns, true)(...args);
            while (ns.isRunning(pid))
                await ns.sleep(50);
            return true;
        } catch (error) {
            await logger(ns).error(error);
            if (!retry)
                return false;
        }
    }
}
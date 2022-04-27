import { logger } from './lib/logger';
import { delegateAny } from './lib/scheduler-delegate';

/** @param {NS} ns */
export const rmi = (ns) => async(...args) => {
    try {
        const { pid } = await delegateAny(ns, true)(...args);
        while (ns.isRunning(pid))
            await ns.sleep(50);
        return true;
    } catch (error) {
        logger(ns).error(error);
        return false;
    }
}
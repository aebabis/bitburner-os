import { delegate } from './lib/scheduler-delegate.js';
import { logger } from './logger';

export const Service = (condition=()=>true, interval=0) => (script, target=null, numThreads=1, ...args) => {
    const desc = (target == null) ?
        [script, numThreads, ...args].join(' ') :
        [script, target, numThreads, ...args].join(' ');
    let pid;
    let lastRun = 0;
    const isRunning = () => pid && ns.isRunning(pid);
    const check = async () => {
        const running = isRunning();
        const shouldBe = condition();
        if (!running && shouldBe) {
            const now = Date.now();
            if (now - lastRun >= interval) {
                lastRun = now;
                logger(ns).info(pid ? 'Attempting to restart' : 'Attempting to start', desc);
                const handle = await delegate(ns, true)(script, target, numThreads, ...args);
                pid = handle.pid;
                if (pid != null)
                    logger(ns).info('Successfully started', desc, `(PID=${pid})`);
                else
                    logger(ns).error('Failed to start', desc);
            }
        } else if (running && !shouldBe) {
            ns.kill(pid);
            pid = null;
        }
    }

    return {
        isRunning,
        check,
        getPid: () => pid,
    }
}

export const AnyHostService = (condition=()=>true, interval) => (script, numThreads, ...args) =>
    Service(condition, interval)(script, null, numThreads, ...args);

import { delegate } from './lib/scheduler-delegate.js';
import { getServices } from './lib/service-api.js';
import { logger } from './lib/logger';

const getExistingPid = (ns, desc) => {
    try {
        const services = getServices(ns);
        if (services != null)
            return services.find(service => service.desc === desc).pid;
    } catch (error) {
        ns.tprint(error);
    }
}

let count = 1;

export const Service = (ns, condition=()=>true, interval=0) => (script, target=null, numThreads=1, ...args) => {
    const console = logger(ns, { echo: false });
    const id = count++;
    const desc = (target == null) ?
        [script, numThreads, ...args].join(' ') :
        [script, target, numThreads, ...args].join(' ');
    const shortname = script.split('/').pop().split('.').shift();
    let pid = getExistingPid(ns, desc);
    let lastRun = 0;
    let enabled = true;
    let queued = false;

    const isRunning = () => pid && ns.isRunning(pid);

    const enable = () => enabled = true;
    const disable = () => enabled = false;

    const stop = () => {
        ns.kill(pid);
        pid = null;
    };

    const statusCode = () => {
        if (!enabled)
            return '🔴';
        else if (queued)
            return '🟡';
        else if (isRunning())
            return '🟢';
        else
            return '💤';
    };

    const check = async (beforeRun) => {
        const running = isRunning();
        const shouldBe = enabled && condition();
        if (!running && shouldBe) {
            const now = Date.now();
            const isReady = now - lastRun >= interval;
            if (isReady) {
                lastRun = now;
                await console.info(pid ? 'Attempting to restart' : 'Attempting to start', desc);
                queued = true;
                if (beforeRun)
                    beforeRun();
                try {
                    const handle = await delegate(ns, true)(script, target, numThreads, ...args);
                    pid = handle.pid;
                    if (pid != null)
                        await console.info('Successfully started', desc, `(PID=${pid})`);
                    else
                        await console.error('Failed to start', desc);
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
    }

    const matches = (identifier) => identifier == id || identifier === shortname;
    const toData = () => ({id, name: shortname, status: statusCode(), pid, desc});

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
    }
}

export const AnyHostService = (ns, condition=()=>true, interval) => (script, numThreads, ...args) =>
    Service(ns, condition, interval)(script, null, numThreads, ...args);
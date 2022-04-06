import { delegate } from './lib/scheduler-delegate.js';
import { getServices } from './lib/planner-api.js';
import { logger } from './logger';

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
    let status = '💤';
    let enabled = true;
    let isForced = false;

    const isRunning = () => pid && ns.isRunning(pid);

    const enable = (forced=false) => {
        enabled = true;
        isForced = forced;
        status = '💤';
    }

    const disable = () => {
        enabled = false;
        isForced = false;
        status = '🔴';
    }

    const stop = () => {
        ns.kill(pid);
        pid = null;
        if (!enabled)
            status = '🔴';
        else
            status = '💤';
    };

    const check = async (beforeRun) => {
        const running = isRunning();
        const shouldBe = enabled && (isForced || condition());
        if (running)
            status = '🟢';
        if (!running && shouldBe) {
            status = '🟡';
            const now = Date.now();
            if (now - lastRun >= interval) {
                lastRun = now;
                await console.info(pid ? 'Attempting to restart' : 'Attempting to start', desc);
                if (beforeRun)
                    beforeRun();
                const handle = await delegate(ns, true)(script, target, numThreads, ...args);
                status = '🟢';
                pid = handle.pid;
                if (pid != null)
                    await console.info('Successfully started', desc, `(PID=${pid})`);
                else
                    await console.error('Failed to start', desc);
            } else {
                status = '💤';
            }
        } else if (running && !shouldBe) {
            stop();
        }
    }

    const matches = (identifier) => identifier == id || identifier === shortname;
    const toData = () => ({id, name: shortname, status, pid, desc});
    const toString = () => ` ${id.toString().padStart(2)}  ${shortname.padEnd(16)} ${status} ${(pid||'').toString().padStart(7)}  ${desc}`;

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
    }
}

export const AnyHostService = (ns, condition=()=>true, interval) => (script, numThreads, ...args) =>
    Service(ns, condition, interval)(script, null, numThreads, ...args);
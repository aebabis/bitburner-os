import { delegate } from './lib/scheduler-delegate.js';
import { logger } from './logger';

let count = 1;

export const Service = (ns, condition=()=>true, interval=0) => (script, target=null, numThreads=1, ...args) => {
    const id = count++;
    const desc = (target == null) ?
        [script, numThreads, ...args].join(' ') :
        [script, target, numThreads, ...args].join(' ');
    const shortname = script.split('/').pop().split('.').shift();
    let pid;
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

    const check = async () => {
        const running = isRunning();
        const shouldBe = enabled && (isForced || condition());
        if (!running && shouldBe) {
            status = '🟡';
            const now = Date.now();
            if (now - lastRun >= interval) {
                lastRun = now;
                await logger(ns).info(pid ? 'Attempting to restart' : 'Attempting to start', desc);
                const handle = await delegate(ns, true)(script, target, numThreads, ...args);
                status = '🟢';
                pid = handle.pid;
                if (pid != null)
                    await logger(ns).info('Successfully started', desc, `(PID=${pid})`);
                else
                    await logger(ns).error('Failed to start', desc);
            }
        } else if (running && !shouldBe) {
            stop();
        }
    }

    const matches = (identifier) => identifier == id || identifier === shortname;
    const toString = () => `${id}  ${shortname.padEnd(16)} ${status} ${(pid||'').toString().padStart(6)} ${desc}`;

    return {
        isRunning,
        check,
        getPid: () => pid,
        toString,
        enable,
        disable,
        stop,
        matches,
    }
}

export const AnyHostService = (ns, condition=()=>true, interval) => (script, numThreads, ...args) =>
    Service(ns, condition, interval)(script, null, numThreads, ...args);
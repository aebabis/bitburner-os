import { delegate } from './lib/scheduler-delegate.js';

const HOME = 'home';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    const Task = (condition=()=>true, interval=0) => (script, target=null, numThreads=1, ...args) => {
        let pid;
        let lastRun = 0;
        const isRunning = () => {
            if (pid == null)
                return false;
            else if (ns.isRunning(pid) == null) {
                pid = null;
                return false;
            } else {
                return true;
            }
        };
        const check = async () => {
            if (isRunning()) {
                if (!condition()) {
                    ns.kill(pid);
                    pid = null;
                }
            } else {
                if (condition()) {
                    const now = Date.now();
                    if (now - lastRun >= interval) {
                        lastRun = now;
                        pid = await delegate(ns, true)(script, target, numThreads, ...args);
                    }
                }
            }
        }

        return {
            isRunning,
            check,
            getPid: () => pid,
        }
    }

    const canHaveGang = () => ns.getPlayer().bitNodeN >= 2;
    const canTradeStocks = () => ns.getPlayer().has4SDataTixApi;
    const canShare = () => ns.getPlayer().currentWorkFactionDescription != null;
    const tasks = [
        Task()('hacknet.js'),
        Task()('access.js'),
        Task()('assistant.js', null, 'service'),
        Task()('ringleader.js'),
        Task(canHaveGang)
              ('gang.js', null, 'service'),
        Task(canTradeStocks, 5000)
              ('broker.js'),
        Task(canShare, 5000)
              ('share.js'), // TODO: Deadman's switch for share?
        // await startAny('servers.js', 'service');
        // await startAny('money.js', 'thief.js');
    ]

    while (true) {
        if (!ns.scriptRunning('scheduler.js', HOME)) {
            ns.exec('scheduler.js', HOME);
        }
        if (!ns.scriptRunning('logger.js', HOME)) {
            ns.exec('logger.js', HOME);
        }
        if (!ns.scriptRunning('server-purchaser.js', HOME)) {
            ns.exec('server-purchaser.js', HOME);
        }
        for (const task of tasks) {
            try {
                await task.check();
            } catch (error) {
                ns.tprint(error);
            }
        }
        await ns.sleep(1000);
    }
}
import { delegate } from './lib/scheduler-delegate.js';
import { logger } from './logger';

const HOME = 'home';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    const Task = (condition=()=>true, interval=0) => (script, target=null, numThreads=1, ...args) => {
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
                    const handle = await delegate(ns, true)(script, target, numThreads, ...args);
                    pid = handle.pid;
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

    const canHaveGang = () => ns.getPlayer().bitNodeN >= 2;
    const canTradeStocks = () => ns.getPlayer().has4SDataTixApi;
    const canShare = () => ns.getPlayer().currentWorkFactionDescription != null;
    const tasks = [
        Task()('server-purchaser.js'),
        Task()('hacknet.js'),
        Task()('access.js'),
        Task()('assistant.js', null, 1, '--tail', 'service'),
        Task()('ringleader.js'),
        Task(canHaveGang)
              ('gang.js', null, 1, 'service'),
        Task(canTradeStocks, 5000)
              ('broker.js'),
        Task(canShare, 5000)
              ('share.js'), // TODO: Deadman's switch for share?
        // await startAny('servers.js', 'service');
        // await startAny('money.js', 'thief.js');
    ]

    while (true) {
        for (const task of tasks) {
            try {
                await task.check();
            } catch (error) {
                logger(ns).error(error);
            }
        }
        await ns.sleep(1000);
    }
}
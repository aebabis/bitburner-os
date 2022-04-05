import { AnyHostService } from './lib/service';
import { logger } from './logger';
import {
    ENABLE, DISABLE,
    writeServices, checkQueue
} from './lib/planner-api.js';

const go = async(ns) => {
    ns.disableLog('ALL');

    ns.tprint(2);
    const canHaveGang = () => ns.getPlayer().bitNodeN >= 2;
    const canTradeStocks = () => ns.getPlayer().has4SDataTixApi;
    const canShare = () => ns.getPlayer().currentWorkFactionDescription != null;
    const tasks = [
        AnyHostService(ns)('server-purchaser.js'),
        AnyHostService(ns)('hacknet.js'),
        AnyHostService(ns)('access.js'),
        AnyHostService(ns)('assistant.js', 1, '--tail', 'service'),
        AnyHostService(ns)('thief.js'),
        AnyHostService(ns, ()=>true, 10000)
                        ('/lib/nmap.js'),
        AnyHostService(ns, canHaveGang)
                        ('/bin/gang/gang-controller.js', 1, 'service'),
        AnyHostService(ns, canTradeStocks, 5000)
                        ('broker.js'),
        AnyHostService(ns, canShare, 5000)
                        ('share.js'), // TODO: Deadman's switch for share?
        // await startAny('servers.js', 'service');
        // await startAny('money.js', 'thief.js');
    ]

    ns.tprint(3);
    while (true) {
        checkQueue(ns).forEach((order) => {
            const { identifier, type, force } = order;
            const task = tasks.find(task => task.matches(identifier));
            if (type === ENABLE)
                task.enable(force);
            if (type === DISABLE)
                task.disable();
        });

        for (const task of tasks) {
            try {
                await task.check();
            } catch (error) {
                await logger(ns).error(error);
            }
        }
        ns.clearLog();
        writeServices(ns, tasks.map(t => t.toString()));
        tasks.forEach(task => ns.print(task.toString()));
        await ns.sleep(1000);
    }
}

/** @param {NS} ns **/
export async function main(ns) {
    ns.tprint(1);
    try {
        await go(ns);
    } catch (error) {
        await logger(ns).error(error);
    }
}
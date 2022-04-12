import { AnyHostService } from './lib/service';
import { logger } from './lib/logger';

import {
    ENABLE, DISABLE,
    writeServices, checkQueue, getTableString,
} from './lib/planner-api.js';

const go = async(ns) => {
    ns.disableLog('ALL');

    const canHaveGang = () => ns.getPlayer().bitNodeN >= 2;
    const canTradeStocks = () => ns.getPlayer().has4SDataTixApi;
    const canShare = () => ns.getPlayer().currentWorkFactionDescription != null;
    const tasks = [
        AnyHostService(ns)('/bin/hacknet.js'),
        AnyHostService(ns)('/bin/thief.js'),
        AnyHostService(ns)('/bin/access.js'),
        AnyHostService(ns)('/bin/server-purchaser.js'),
        AnyHostService(ns)('assistant.js', 1, '--tail', 'service'),
        AnyHostService(ns, ()=>true, 10000)
                        ('/lib/nmap.js'),
        AnyHostService(ns, canHaveGang)
                        ('/bin/gang/gang-controller.js', 1, 'service'),
        AnyHostService(ns, canTradeStocks, 5000)
                        ('/bin/broker.js'),
        AnyHostService(ns, canShare, 5000)
                        ('/bin/share.js'), // TODO: Deadman's switch for share?
        // await startAny('servers.js', 'service');
        // await startAny('money.js', 'thief.js');
    ]

    const showServices = () => {
        ns.clearLog();
        const taskData = tasks.map(task => task.toData());
        writeServices(ns, taskData);
        ns.print(getTableString(ns, taskData));
    }

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
                await task.check(showServices);
            } catch (error) {
                await logger(ns).error(error);
            }
        }

        showServices();

        await ns.sleep(1000);
    }
}

/** @param {NS} ns **/
export async function main(ns) {
    try {
        await go(ns);
    } catch (error) {
        await logger(ns).error(error);
    }
}
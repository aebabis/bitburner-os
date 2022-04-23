import { AnyHostService } from './lib/service';
import { getGangData } from './lib/data-store';
import { logger } from './lib/logger';

import {
    ENABLE, DISABLE,
    writeServices, checkQueue, getTableString,
} from './lib/planner-api.js';

/** @param {NS} ns **/
const go = async(ns) => {
    ns.disableLog('ALL');
    const canTradeStocks = () => ns.getPlayer().has4SDataTixApi;
    const canShare = () => ns.getPlayer().currentWorkFactionDescription != null;
    const canBuyTixAccess = () => !canTradeStocks();
    const couldStartGang = () => ns.getPlayer().bitNodeN >= 2 && !isInGang();
    const isInGang = () => getGangData(ns) != null;

    const tasks = [
        AnyHostService(ns)('/bin/access.js'),
        AnyHostService(ns)('/bin/hacknet.js'),
        AnyHostService(ns)('/bin/thief.js'),
        AnyHostService(ns)('/bin/server-purchaser.js'),
        AnyHostService(ns)('assistant.js', 1, '--tail', 'service'),
        AnyHostService(ns, ()=>true, 10000)
                        ('/lib/nmap.js'),
        AnyHostService(ns, canBuyTixAccess, 5000)
                        ('/bin/market-access.js'),
        AnyHostService(ns, canTradeStocks, 5000)
                        ('/bin/broker.js'),
        AnyHostService(ns, canShare, 5000)
                        ('/bin/share.js'), // TODO: Deadman's switch for share?
        AnyHostService(ns, couldStartGang, 5000)
                        ('/bin/gang/gang-data.js'),
        AnyHostService(ns, isInGang, 10000)
                        ('/bin/gang/recruit.js'),
        AnyHostService(ns, isInGang, 5000)
                        ('/bin/gang/assign-members.js'),
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
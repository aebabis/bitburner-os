import { AnyHostService } from './lib/service';
import { getGangData, getStaticData } from './lib/data-store';
import { logger } from './lib/logger';

import {
    ENABLE, DISABLE,
    writeServices, checkQueue, getTableString,
} from './lib/service-api';

/** @param {NS} ns **/
const go = async(ns) => {
    ns.disableLog('ALL');
    const { bitNodeN } = ns.getPlayer();
    const { ownedSourceFiles } = getStaticData(ns);
    const hasSingularity = () => bitNodeN === 4 || ownedSourceFiles.find(file => file.n === 4);
    const canPurchaseServers = () => ns.getPlayer().money >= 220000;
    const canTradeStocks = () => ns.getPlayer().has4SDataTixApi;
    const canBuyTixAccess = () => !canTradeStocks();
    const couldStartGang = () => bitNodeN >= 2 && !isInGang();
    const isInGang = () => getGangData(ns) != null;
    const augsUp = () => getStaticData(ns).targetFaction != null;

    const tasks = [
        AnyHostService(ns)('/bin/access.js'),
        AnyHostService(ns)('/bin/hacknet.js'),
        AnyHostService(ns)('/bin/thief.js'),
        AnyHostService(ns, canPurchaseServers, 1000)
                        ('/bin/server-purchaser.js'),
        AnyHostService(ns)('/bin/dashboard.js'),
        AnyHostService(ns, canBuyTixAccess, 5000)
                        ('/bin/market-access.js'),
        AnyHostService(ns, canTradeStocks, 5000)
                        ('/bin/broker.js'),
        AnyHostService(ns)('/bin/share.js'),
        AnyHostService(ns, couldStartGang, 5000)
                        ('/bin/gang/gang-data.js'),
        AnyHostService(ns, isInGang, 10000)
                        ('/bin/gang/recruit.js'),
        AnyHostService(ns, isInGang, 5000)
                        ('/bin/gang/assign-members.js'),
        AnyHostService(ns, hasSingularity)
                        ('/bin/self/aug/augment.js'),
        AnyHostService(ns, augsUp, 5000)
                        ('/bin/self/work.js'),
        AnyHostService(ns, augsUp, 5000)
                        ('/bin/self/control.js'),
        AnyHostService(ns, augsUp, 5000)
                        ('/bin/self/focus.js'),
        AnyHostService(ns, augsUp, 5000)
                        ('/bin/self/tor.js'),
        // await startAny('servers.js', 'service');
        // await startAny('money.js', 'thief.js');
    ];

    const showServices = () => {
        ns.clearLog();
        const taskData = tasks.map(task => task.toData());
        writeServices(ns, taskData);
        ns.print(getTableString(ns, taskData));
    }

    const updateTasks = () => {
        checkQueue(ns).forEach((order) => {
            const { identifier, type, force } = order;
            const task = tasks.find(task => task.matches(identifier));
            if (type === ENABLE)
                task.enable(force);
            if (type === DISABLE)
                task.disable();
        });
    }

    while (true) {
        for (const task of tasks) {
            try {
                updateTasks();
                showServices();
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

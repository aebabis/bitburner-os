import { AnyHostService } from './lib/service';
import { getStaticData, getRamData } from './lib/data-store';
import { hasSingularityApi, couldHaveGang } from './lib/query-service';
import { logger } from './lib/logger';

import {
    ENABLE, DISABLE,
    writeServices, checkQueue, getTableString,
} from './lib/service-api';

const mostRootRam = (ns) => {
    const { rootServers=[] } = getRamData(ns);
    return Math.max(0, ...rootServers.map(server => server.maxRam));
};

/** @param {NS} ns **/
const go = async(ns) => {
    ns.disableLog('ALL');
    const { requiredJobRam, purchasedServerCosts } = getStaticData(ns);

    const hasSingularity = hasSingularityApi(ns);

    const canPurchaseServers = () => ns.getPlayer().money >= purchasedServerCosts[4];
    const couldTrade = () => ns.getPlayer().hasTixApiAccess || ns.getPlayer().money >= 5.2e9;
    const canAutopilot = () => hasSingularity && requiredJobRam <= mostRootRam(ns);
    const canRunGang = () => couldHaveGang(ns, ns.getPlayer());

    /* eslint-disable no-unexpected-multiline */
    const tasks = [
        AnyHostService(ns)('/bin/access.js'),
        AnyHostService(ns)('/bin/hacknet.js'),
        AnyHostService(ns)('/bin/thief.js'),
        AnyHostService(ns, canPurchaseServers, 1000)
                          ('/bin/server-purchaser.js'),
        AnyHostService(ns)('/bin/dashboard.js'),
        AnyHostService(ns)('/bin/accountant.js'),
        AnyHostService(ns)('/bin/contracts/freelancer.js'),
        AnyHostService(ns)('/bin/share.js'),
        AnyHostService(ns)('/bin/stalker.js'),
        AnyHostService(ns, couldTrade)
                          ('/bin/broker/broker.js'),
        AnyHostService(ns, canRunGang)
                          ('/bin/gang/mob-boss.js'),
        AnyHostService(ns, canAutopilot)('/bin/self/aug/augment.js'),
        AnyHostService(ns, canAutopilot)('/bin/self/work.js'),
        AnyHostService(ns, canAutopilot)('/bin/self/control.js'),
        AnyHostService(ns, canAutopilot)('/bin/self/tor.js'),
        AnyHostService(ns, canAutopilot)('/bin/self/rep-recorder.js'),
    ];

    const showServices = () => {
        ns.clearLog();
        const taskData = tasks.map(task => task.toData());
        writeServices(ns, taskData);
        ns.print(getTableString(ns, taskData));
    };

    const updateTasks = () => {
        checkQueue(ns).forEach((order) => {
            const { identifier, type, force } = order;
            const task = tasks.find(task => task.matches(identifier));
            if (type === ENABLE)
                task.enable(force);
            if (type === DISABLE)
                task.disable();
        });
    };

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
};

/** @param {NS} ns **/
export async function main(ns) {
    try {
        await go(ns);
    } catch (error) {
        await logger(ns).error(error);
    }
}
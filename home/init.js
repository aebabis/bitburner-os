import { AnyHostService } from './lib/service';
import { logger } from './logger';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    const canHaveGang = () => ns.getPlayer().bitNodeN >= 2;
    const canTradeStocks = () => ns.getPlayer().has4SDataTixApi;
    const canShare = () => ns.getPlayer().currentWorkFactionDescription != null;
    const tasks = [
        AnyHostService(ns)('server-purchaser.js'),
        AnyHostService(ns)('hacknet.js'),
        AnyHostService(ns)('access.js'),
        AnyHostService(ns)('assistant.js', 1, '--tail', 'service'),
        AnyHostService(ns)('thief.js'),
        AnyHostService(ns, canHaveGang)
                        ('/bin/gang/gang-controller.js', 1, 'service'),
        AnyHostService(ns, canTradeStocks, 5000)
                        ('broker.js'),
        AnyHostService(ns, canShare, 5000)
                        ('share.js'), // TODO: Deadman's switch for share?
        // await startAny('servers.js', 'service');
        // await startAny('money.js', 'thief.js');
    ]

    while (true) {
        for (const task of tasks) {
            try {
                await task.check();
            } catch (error) {
                await logger(ns).error(error);
            }
        }
        await ns.sleep(1000);
    }
}
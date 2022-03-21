import { AnyHostService } from './lib/service';
import { logger } from './logger';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    const canHaveGang = () => ns.getPlayer().bitNodeN >= 2;
    const canTradeStocks = () => ns.getPlayer().has4SDataTixApi;
    const canShare = () => ns.getPlayer().currentWorkFactionDescription != null;
    const tasks = [
        AnyHostService()('server-purchaser.js'),
        AnyHostService()('hacknet.js'),
        AnyHostService()('access.js'),
        AnyHostService()('assistant.js', 1, '--tail', 'service'),
        AnyHostService()('ringleader.js'),
        AnyHostService(canHaveGang)
                        ('/bin/gang/gang-controller.js', 1, 'service'),
        AnyHostService(canTradeStocks, 5000)
                        ('broker.js'),
        AnyHostService(canShare, 5000)
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
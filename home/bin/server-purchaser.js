import { PORT_SCH_RAM_DATA } from './etc/ports';
import { PURCHASE_THREADPOOL } from './etc/filenames';
import Ports from './lib/ports';
import { delegate } from './lib/scheduler-delegate';
import { logger } from './lib/logger';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    const console = logger(ns);
    while (true) {
        const port = Ports(ns).getPortHandle(PORT_SCH_RAM_DATA);
        const ramData = port.peek();
        if (ramData != null && !ramData.purchasedServersMaxedOut) {
            const {
                purchasedServers,
                purchasedServerMaxRam,
                purchasedServerLimit,
                totalRamUsed,
                totalMaxRam,
                ramQueued,
            } = ramData;

            // Allow a 20% buffer
            const atCapacity = totalRamUsed + ramQueued > totalMaxRam * .8;
        
            if (atCapacity) {
		        const money = ns.getServerMoneyAvailable('home');
                const atMaxServers = purchasedServers.length === purchasedServerLimit;
                const smallest = purchasedServers.reduce((s1,s2)=>s1.maxRam<=s2.maxRam?s1:s2, purchasedServers[0]);
                let lowerLimit = 2;
                if (atMaxServers)
                    lowerLimit = smallest.maxRam * 2;
                let ram = purchasedServerMaxRam;
                while (ram >= lowerLimit && ns.getPurchasedServerCost(ram) > money) {
                    ram >>= 1;
                }
                if (ram >= lowerLimit) {
                    try {
                        let pid;
                        if (atMaxServers) {
                            await console.log(`Attempting to replace ${smallest.hostname}`);
                            pid = (await delegate(ns, true)(PURCHASE_THREADPOOL, 'home', 1, ram, smallest.hostname)).pid;
                        } else {
                            await console.log(`Attempting to buy new server`);
                            pid = (await delegate(ns, true)(PURCHASE_THREADPOOL, 'home', 1, ram)).pid;
                        }
                        while (ns.isRunning(pid))
                            await ns.sleep(50);
                    } catch (error) {
                        await console.error(error);
                    }
                }
            }
        }
        await ns.sleep(50);
    }
}

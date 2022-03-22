import { PORT_SCH_RAM_DATA } from './etc/ports';
import { PURCHASE_THREADPOOL } from './etc/filenames';
import Ports from './lib/ports';
import { by } from './lib/util';
import { delegate } from './lib/scheduler-delegate';
import { logger } from './logger';

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
                demand,
            } = ramData;

            // Allow a 20% buffer
            const atCapacity = totalRamUsed + demand > totalMaxRam * .8;
        
            if (atCapacity) {
		        const money = ns.getServerMoneyAvailable('home');
                const atMaxServers = purchasedServers.length === purchasedServerLimit;
                const [smallest] = purchasedServers.slice().sort(by(s=>s.availableRam));
                let lowerLimit = 2;
                if (atMaxServers)
                    lowerLimit = smallest.maxRam * 2;
                let ram = purchasedServerMaxRam;
                while (ram >= lowerLimit && ns.getPurchasedServerCost(ram) > money) {
                    ram >>= 1;
                }
                if (ram >= lowerLimit) {
                    let pid;
                    if (atMaxServers) {
                        await console.log(`Attempting to replace ${smallest.hostname}`);
                        pid = (await delegate(ns, true)(PURCHASE_THREADPOOL, 'home', 1, 'replace', smallest.hostname, ram)).pid;
                    } else {
                        await console.log(`Attempting to buy new server`);
                        pid = (await delegate(ns, true)(PURCHASE_THREADPOOL, 'home', 1, 'purchase', ram)).pid;
                    }
                    while (ns.isRunning(pid))
                        await ns.sleep(50);
                }
            }
        }
        await ns.sleep(50);
    }
}
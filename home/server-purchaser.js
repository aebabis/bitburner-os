import { PORT_SCH_RAM_DATA } from './etc/ports';
import { PURCHASE_THREADPOOL } from './etc/filenames';
import Ports from './lib/ports';

/** @param {NS} ns **/
export async function main(ns) {
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
                const lowerLimit = 2;
                if (atMaxServers)
                    lowerLimit = purchasedServers[0].maxRam * 2;
                let ram = purchasedServerMaxRam;
                while (ram >= lowerLimit && ns.getPurchasedServerCost(ram) > money) {
                    ram >>= 1;
                }
                if (ram >= lowerLimit) {
                    if (atMaxServers) {
                        ns.exec(PURCHASE_THREADPOOL, 'home', 1, 'replace', smallest.hostname, ram);
                    } else {
                        ns.exec(PURCHASE_THREADPOOL, 'home', 1, 'purchase', ram);
                    }
                }
            }
        }
        await ns.sleep(50);
    }
}
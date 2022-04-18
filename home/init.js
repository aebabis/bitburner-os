import { WEAKEN, GROW, HACK } from './etc/filenames';
import { saveHostnames  } from './lib/nmap';
import { putStaticData } from './lib/data-store';
import getConfig from './lib/config';

import { PORT_RUN_CONFIG, PORT_SERVICES_LIST } from './etc/ports';
const PERSISTENT_PORTS = [PORT_RUN_CONFIG, PORT_SERVICES_LIST];

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    // Clear all ports
    for (let i = 1; i <= 20; i++)
        if (!PERSISTENT_PORTS.includes(i))
            ns.clearPort(i);

    getConfig(ns).set('share', 0);    // No faction, no share

    // Generate list of hostnames
    saveHostnames(ns);
    
    putStaticData(ns, {
        weakenScriptRam: ns.getScriptRam(WEAKEN),
        growScriptRam: ns.getScriptRam(GROW),
        hackScriptRam: ns.getScriptRam(HACK),
		purchasedServerMaxRam: ns.getPurchasedServerMaxRam(),
		purchasedServerLimit: ns.getPurchasedServerLimit(),
        // hacknetProductionMultiplier: ns.getHacknetMultipliers().production(),
    });

    ns.tprint('Starting scheduler');
	ns.exec('/bin/scheduler.js', 'home', 1, 'bootstrap');
}
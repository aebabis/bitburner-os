import { WEAKEN, GROW, HACK } from './etc/filenames';
import { saveHostnames  } from './lib/nmap';
import { putStaticData } from './lib/data-store';

import { PORT_RUN_CONFIG, PORT_SERVICES_LIST } from './etc/ports';
const PERSISTENT_PORTS = [PORT_RUN_CONFIG, PORT_SERVICES_LIST];

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    // Close all dialogs
    [...eval('document').querySelectorAll('.MuiButton-root')]
        .filter(e => e.innerText === 'Close')
        .forEach(closeButton=>closeButton.click());

    // Clear all ports except configuration ports
    for (let i = 1; i <= 20; i++)
        if (!PERSISTENT_PORTS.includes(i))
            ns.clearPort(i);

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
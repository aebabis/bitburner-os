import { putStaticData,  } from './lib/data-store';
import { defer } from './boot/defer';
import { tprint } from './boot/util';
import { saveHostnames } from './lib/nmap';
import { STR } from './lib/colors';

/** @param {NS} ns */
export async function main(ns) {
    tprint(ns)(STR.BOLD + 'GENERATING STATIC DATA');

    tprint(ns)(STR + '  Precalculating static server costs');
    const purchasedServerMaxRam = ns.getPurchasedServerMaxRam();
    const purchasedServerCosts = {};
    for (let ram = purchasedServerMaxRam; ram >= 2; ram /= 2)
        purchasedServerCosts[ram] = ns.getPurchasedServerCost(ram);

    tprint(ns)(STR + '  Storing script RAM costs');
    const scriptRam = {};
    const scripts = ns.ls('home').filter(file=>file.endsWith('.js'));
    for (const script of scripts)
        scriptRam[script] = ns.getScriptRam(script);

    tprint(ns)(STR + '  Caching network map');
    saveHostnames(ns);

    const resetInfo = ns.getResetInfo();

    putStaticData(ns, {
        resetInfo,
        ownedSourceFiles: [], // To be overwritten in next step, RAM permitting
        scriptRam,
		purchasedServerLimit: ns.getPurchasedServerLimit(),
		purchasedServerMaxRam,
        purchasedServerCosts,
    });

    // Go to next step in the boot sequence
	await defer(ns)(...ns.args);
}
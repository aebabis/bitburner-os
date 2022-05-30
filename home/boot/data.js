import { putStaticData } from './lib/data-store';
import { defer } from './boot/defer';
import { C_MAIN, C_SUB, tprint } from './boot/util';

/** @param {NS} ns */
export async function main(ns) {
    tprint(ns)(C_MAIN + 'GENERATING STATIC DATA');

    tprint(ns)(C_SUB + '  Precalculating static server costs');
    const purchasedServerMaxRam = ns.getPurchasedServerMaxRam();
    const purchasedServerCosts = {};
    for (let ram = purchasedServerMaxRam; ram >= 2; ram /= 2)
        purchasedServerCosts[ram] = ns.getPurchasedServerCost(ram);

    tprint(ns)(C_SUB + '  Storing script RAM costs');
    const scriptRam = {};
    const scripts = ns.ls('home').filter(file=>file.endsWith('.js'));
    for (const script of scripts)
        scriptRam[script] = ns.getScriptRam(script);

    putStaticData(ns, {
        bitNodeN: ns.getPlayer().bitNodeN,
        ownedSourceFiles: [], // To be overwritten in next step, RAM permitting
        scriptRam,
		purchasedServerLimit: ns.getPurchasedServerLimit(),
		purchasedServerMaxRam,
        purchasedServerCosts,
    });

    // Go to next step in the boot sequence
	await defer(ns)(...ns.args);
}
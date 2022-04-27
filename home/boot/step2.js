import { putStaticData } from './lib/data-store';
import { defer } from './boot/defer';

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint('Generating static data');

    const purchasedServerMaxRam = ns.getPurchasedServerMaxRam();
    const purchasedServerCosts = {};
    for (let ram = purchasedServerMaxRam; ram >= 2; ram /= 2)
        purchasedServerCosts[ram] = ns.getPurchasedServerCost(ram);

    const scriptRam = {};
    const scripts = ns.ls('home').filter(file=>file.endsWith('.js'));
    for (const script of scripts)
        scriptRam[script] = ns.getScriptRam(script);

    putStaticData(ns, {
        bitNodeN: ns.getPlayer().bitNodeN,
        scriptRam,
		purchasedServerLimit: ns.getPurchasedServerLimit(),
		purchasedServerMaxRam,
        purchasedServerCosts,
    });

    // Go to next step in the boot sequence
	defer(ns)(...ns.args);
}
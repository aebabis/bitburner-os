import { putStaticData } from './lib/data-store';
import { defer } from './boot/defer';

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint('Adding source files to static data cache');
    const ownedSourceFiles = ns.getOwnedSourceFiles();

    const canUseHackNodes = ns.getPlayer().bitNodeN === 5 || ownedSourceFiles.some(node => node.n === 5);
    let bitNodeMultipliers = null;

    if (canUseHackNodes) {
        ns.tprint('Adding bit node multipliers to static data cache');
        bitNodeMultipliers = ns.getBitNodeMultipliers();
    }

    putStaticData(ns, {
        ownedSourceFiles,
        bitNodeMultipliers,
        hacknetMultipliers: ns.getHacknetMultipliers(),
    });

    // Go to next step in the boot sequence
	defer(ns)(...ns.args);
}
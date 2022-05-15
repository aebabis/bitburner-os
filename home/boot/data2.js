import { putStaticData } from './lib/data-store';
import { defer } from './boot/defer';
import { getBitNodeMultipliers } from './boot/cheaty-data';

/** @param {NS} ns */
export async function main(ns) {
    const { bitNodeN } = ns.getPlayer();

    ns.tprint('Adding source files to static data cache');
    const ownedSourceFiles = ns.getOwnedSourceFiles();

    const canUseHackNodes = bitNodeN === 5 || ownedSourceFiles.some(node => node.n === 5);
    let bitNodeMultipliers = null;

    if (canUseHackNodes) {
        ns.tprint('Adding bit node multipliers to static data cache');
        bitNodeMultipliers = ns.getBitNodeMultipliers();
    } else {
        bitNodeMultipliers = getBitNodeMultipliers(bitNodeN);
    }

    putStaticData(ns, {
        ownedSourceFiles,
        bitNodeMultipliers,
        hacknetMultipliers: ns.getHacknetMultipliers(),
    });

    // Go to next step in the boot sequence
	defer(ns)(...ns.args);
}
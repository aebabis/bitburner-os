import { putStaticData } from './lib/data-store';
import { defer } from './boot/defer';
import { getBitNodeMultipliers } from './boot/cheaty-data';
import { C_MAIN, C_SUB, tprint } from './boot/util';

/** @param {NS} ns */
export async function main(ns) {
    const { bitNodeN } = ns.getPlayer();
    tprint(ns)(C_MAIN + 'ADDING MULTIPLIERS TO CACHE');

    tprint(ns)(C_SUB + '  Adding source files to static data cache');
    const ownedSourceFiles = ns.getOwnedSourceFiles();

    const canUseHackNodes = bitNodeN === 5 || ownedSourceFiles.some(node => node.n === 5);
    let bitNodeMultipliers = null;

    if (canUseHackNodes) {
        tprint(ns)(C_SUB + '  Adding bit node multipliers to static data cache');
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
	await defer(ns)(...ns.args);
}
import { getStaticData, putStaticData } from '/lib/data-store';
import { defer } from '/boot/defer';
import { getBitNodeMultipliers } from '/boot/cheaty-data';
import { tprint } from '/boot/util';
import { STR } from '/lib/colors';

/** @param {NS} ns */
export async function main(ns) {
    const { currentNode } = getStaticData(ns).resetInfo;
    tprint(ns)(STR.BOLD + 'ADDING MULTIPLIERS TO CACHE');

    tprint(ns)(STR + '  Adding source files to static data cache');
    const ownedSourceFiles = ns.getOwnedSourceFiles();

    const canUseHackNodes = currentNode === 5 || ownedSourceFiles.some(node => node.n === 5);
    let bitNodeMultipliers = null;

    if (canUseHackNodes) {
        tprint(ns)(STR + '  Adding bit node multipliers to static data cache');
        bitNodeMultipliers = ns.getBitNodeMultipliers();
    } else {
        bitNodeMultipliers = getBitNodeMultipliers(currentNode);
    }

    putStaticData(ns, {
        ownedSourceFiles,
        bitNodeMultipliers,
        hacknetMultipliers: ns.getHacknetMultipliers(),
    });

    // Go to next step in the boot sequence
	await defer(ns)(...ns.args);
}

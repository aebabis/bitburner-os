import { putStaticData } from './lib/data-store';
import * as cheaty from './boot/cheaty-data';
import { tprint } from './boot/util';
import { STR } from './lib/colors';

/** 
 * @precondition Running on BN1.1
 * @param {NS} ns */
export async function main(ns) {
    tprint(ns)(STR.BOLD + 'ADDING MULTIPLIERS TO CACHE');

    putStaticData(ns, {
        ownedSourceFiles: [],
        hacknetMultipliers: ns.getHacknetMultipliers(),
        bitNodeMultipliers: cheaty['getBitNodeMultipliers'](1),
    });

    // Go to next step in the boot sequence
    const [script, ...rest] = ns.args;
    ns.spawn(script, 1, ...rest);
}
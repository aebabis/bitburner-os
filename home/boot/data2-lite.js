import { putStaticData } from './lib/data-store';
import { getBitNodeMultipliers } from './boot/cheaty-data';

/** 
 * @precondition Running on BN1.1
 * @param {NS} ns */
export async function main(ns) {
    ns.tprint('Adding hacknet multipliers to static data cache');

    putStaticData(ns, {
        hacknetMultipliers: ns.getHacknetMultipliers(),
        getBitNodeMultipliers: getBitNodeMultipliers(1),
    });

    // Go to next step in the boot sequence
    const [script, ...rest] = ns.args;
    ns.spawn(script, 1, ...rest);
}
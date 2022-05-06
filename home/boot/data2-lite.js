import { putStaticData } from './lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint('Adding hacknet multipliers to static data cache')

    putStaticData(ns, {
        hacknetMultipliers: ns.getHacknetMultipliers(),
    });

    // Go to next step in the boot sequence
    const [script, ...rest] = ns.args;
    ns.spawn(script, 1, ...rest);
}
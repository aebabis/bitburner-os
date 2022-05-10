import { putStaticData  } from './lib/data-store';
import { FACTIONS } from './bin/self/aug/factions';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    ns.tprint('Loading Faction Favor');

    const factionFavor = {};

    for (const faction of FACTIONS)
        factionFavor[faction] = ns.getFactionFavor(faction);

    putStaticData(ns, { factionFavor });
}
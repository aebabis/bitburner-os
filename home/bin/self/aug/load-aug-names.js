import { putStaticData  } from './lib/data-store';
import { FACTIONS } from './bin/self/aug/factions';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    ns.tprint('Loading Augmentation Names');

    const factionAugmentations = {};
    const augSet = new Set();

    for (const faction of FACTIONS) {
        const list = ns.getAugmentationsFromFaction(faction);
        factionAugmentations[faction] = list;
        for (const name of list)
            augSet.add(name);
    }
    const augmentations = [...augSet];

    putStaticData(ns, { factionAugmentations, augmentations });
}
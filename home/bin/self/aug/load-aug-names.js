import { putStaticData  } from './lib/data-store';
import { FACTIONS } from './bin/self/aug/factions';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    ns.tprint('Loading Augmentation Names');

    const factionAugmentations = {};
    const nameMap = {};

    for (const faction of FACTIONS) {
        const list = factionAugmentations[faction] = ns.getAugmentationsFromFaction(faction);
        for (const name of list) {
            nameMap[name] = true;
        }
    }
    const augmentations = Object.keys(nameMap);

    putStaticData(ns, { factionAugmentations, augmentations });
}
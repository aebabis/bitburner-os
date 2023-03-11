import { putStaticData, putPlayerData  } from './lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    ns.tprint('Loading Owned Augmentations');

    const ownedAugmentations = ns.singularity.getOwnedAugmentations();
    const purchasedAugmentations = ns.singularity.getOwnedAugmentations(true);

    putStaticData(ns, { ownedAugmentations });
    putPlayerData(ns, { purchasedAugmentations });
}

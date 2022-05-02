import { getStaticData, getPlayerData, putPlayerData  } from './lib/data-store';
import { rmi } from './lib/rmi';
import { by } from './lib/util';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const {
        targetFaction,
        neededAugmentations,
        augmentationPrices,
    } = getStaticData(ns);
    const { purchasedAugmentations } = getPlayerData(ns);

    const remainingAugs = neededAugmentations[targetFaction]
        .filter(aug => !purchasedAugmentations.includes(aug));
    remainingAugs.sort(by(aug => -augmentationPrices[aug]));

    for (const augmentation of remainingAugs) {
        if (ns.purchaseAugmentation(targetFaction, augmentation)) {
            purchasedAugmentations.push(augmentation);
        }
    }

    if (remainingAugs.every(aug => purchasedAugmentations.includes(aug))) {
        await rmi(ns)('/bin/broker.js', 1, 'dump');
        while (ns.purchaseAugmentation(targetFaction, 'NeuroFlux Governor'));
        await rmi(ns)('/bin/self/aug/install.js', 1, 'init.js');
    }

    putPlayerData(ns, { purchasedAugmentations, remainingAugs });
}

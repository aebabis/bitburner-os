import { getStaticData, getPlayerData, putPlayerData  } from './lib/data-store';
import { disableService } from './lib/planner-api';
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
    const {
        purchasedThisAug = []
    } = getPlayerData(ns);

    const remainingAugs = neededAugmentations[targetFaction]
        .filter(aug => !purchasedThisAug.includes(aug));
    remainingAugs.sort(by(aug => -augmentationPrices[aug]));

    for (const augmentation of remainingAugs) {
        if (ns.purchaseAugmentation(targetFaction, augmentation)) {
            purchasedThisAug.push(augmentation);
        }
    }

    if (remainingAugs.every(aug => purchasedThisAug.includes(aug))) {
        while (ns.purchaseAugmentation(targetFaction, 'NeuroFlux Governor'));
        ns.toast('TODO: Restart needed');
        disableService(ns, 'augment');
    }

    putPlayerData(ns, { purchasedThisAug, remainingAugs });
}

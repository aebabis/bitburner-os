import { getStaticData, putStaticData  } from './lib/data-store';
import { rmi } from './lib/rmi';
import { by } from './lib/util';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const {
        targetFaction,
        factionAugmentations,
        augmentationPrices,
    } = getStaticData(ns);

    const targetAugmentations = factionAugmentations[targetFaction];
    targetAugmentations.sort(by(aug => -augmentationPrices[aug]));

    if (targetAugmentations.every(aug => ns.purchaseAugmentation(targetFaction, aug))) {
        while (ns.purchaseAugmentation(targetFaction, 'NeuroFlux Governor'));
        ns.toast('TODO: Restart needed');
    }
}

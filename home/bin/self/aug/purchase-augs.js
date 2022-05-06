import { getStaticData, getPlayerData, putPlayerData  } from './lib/data-store';
import { rmi } from './lib/rmi';
import { by } from './lib/util';

const NEUROFLUX = 'NeuroFlux Governor';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const {
        targetFaction,
        neededAugmentations,
        augmentationPrices,
        factionAugmentations,
    } = getStaticData(ns);
    const { purchasedAugmentations } = getPlayerData(ns);

    const remainingAugs = neededAugmentations[targetFaction]
        .filter(aug => !purchasedAugmentations.includes(aug));
    remainingAugs.sort(by(aug => -augmentationPrices[aug]));

    for (const augmentation of remainingAugs) {
        if (ns.purchaseAugmentation(targetFaction, augmentation))
            purchasedAugmentations.push(augmentation);
        else
            break;
    }

    if (remainingAugs.every(aug => purchasedAugmentations.includes(aug))) {
        await rmi(ns)('/bin/broker.js', 1, 'dump');
        // TODO: Make all purchases use a reverse-lookup, not just
        // these
        const neuroFluxFaction = ns.getPlayer().factions
            .filter(faction=>factionAugmentations[faction].includes(NEUROFLUX))
            .reduce((a,b)=>ns.getFactionRep(a)>ns.getFactionRep(b)?a:b);
        while (ns.purchaseAugmentation(neuroFluxFaction, NEUROFLUX));
        await rmi(ns)('/bin/self/aug/install.js', 1, 'init.js');
    }

    putPlayerData(ns, { purchasedAugmentations, remainingAugs });
}

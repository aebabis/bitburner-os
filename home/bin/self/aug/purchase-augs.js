import {
    getStaticData,
    getPlayerData,
    putPlayerData,
    getMoneyData,
    putMoneyData
} from './lib/data-store';
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
        augmentationPrereqs,
    } = getStaticData(ns);
    const { purchasedAugmentations } = getPlayerData(ns);
    const { income } = getMoneyData(ns);

    const remainingAugs = neededAugmentations[targetFaction]
        .filter(aug => !purchasedAugmentations.includes(aug));
    remainingAugs.sort(by(aug => -augmentationPrices[aug]));

    const purchasable = aug => (augmentationPrereqs[aug] || [])
        .every(prereq => purchasedAugmentations.includes(prereq));

    let nextPurchase;
    while (nextPurchase = remainingAugs.find(purchasable)) {
        if (ns.purchaseAugmentation(targetFaction, nextPurchase)) {
            purchasedAugmentations.push(nextPurchase);
            remainingAugs.shift();
        } else {
            break;
        }
    }

    let multiplier = 1.9**purchasedAugmentations.length;
    let costToAug = 0;
    const costOfNextAugmentation = augmentationPrices[nextPurchase] * multiplier || null;
    for (const augmentation of remainingAugs) {
        costToAug += multiplier * augmentationPrices[augmentation];
        multiplier *= 1.9;
    }
    const timeToAug = costToAug / income;
    putMoneyData(ns, { costToAug, timeToAug, costOfNextAugmentation });

    if (remainingAugs.every(aug => purchasedAugmentations.includes(aug))) {
        await rmi(ns)('/bin/broker.js', 1, 'dump');
        // TODO: Make all purchases use a reverse-lookup, not just
        // these
        const neuroFluxFaction = ns.getPlayer().factions
            .filter(faction=>factionAugmentations[faction].includes(NEUROFLUX))
            .reduce((a,b)=>ns.getFactionRep(a)>ns.getFactionRep(b)?a:b);
        while (ns.purchaseAugmentation(neuroFluxFaction, NEUROFLUX));
        await rmi(ns)('/bin/self/buy-ram.js', 1);
        await rmi(ns)('/bin/self/aug/install.js', 1, 'init.js');
    }

    putPlayerData(ns, { purchasedAugmentations, remainingAugs });
}

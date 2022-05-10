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
        augmentations,
        targetFaction,
        augmentationPrices,
        augmentationRepReqs,
        factionAugmentations,
        ownedAugmentations,
        augmentationPrereqs,
        targetAugmentations,
    } = getStaticData(ns);
    const { purchasedAugmentations } = getPlayerData(ns);
    const { money, income } = getMoneyData(ns);

    const remainingAugs = targetAugmentations
        .filter(aug => !purchasedAugmentations.includes(aug))
        .sort(by(aug => -augmentationRepReqs[aug]))
        .sort(by(aug => -augmentationPrices[aug]));

    const purchasable = aug => (augmentationPrereqs[aug] || [])
        .every(prereq => purchasedAugmentations.includes(prereq));

    let nextPurchase;
    while (nextPurchase = remainingAugs.find(purchasable)) {
        if (ns.purchaseAugmentation(targetFaction, nextPurchase)) {
            purchasedAugmentations.push(nextPurchase);
            remainingAugs.splice(remainingAugs.indexOf(nextPurchase), 1);
        } else {
            break;
        }
    }

    const queuedAugmentations = purchasedAugmentations.filter(aug => !ownedAugmentations.includes(aug));
    let multiplier = 1.9**queuedAugmentations.length;
    let costToAug = 0;
    const costOfNextAugmentation = augmentationPrices[nextPurchase] * multiplier || null;
    for (const augmentation of remainingAugs) {
        costToAug += multiplier * augmentationPrices[augmentation];
        multiplier *= 1.9;
    }
    const timeToAug = (costToAug-money) / income;
    putMoneyData(ns, { costToAug, timeToAug, costOfNextAugmentation });

    if (remainingAugs.every(aug => purchasedAugmentations.includes(aug))) {
        await rmi(ns)('/bin/broker.js', 1, 'dump');

        const { factions } = ns.getPlayer();

        // Attempt to buy as many faction augmentations
        // as possible, starting with the most expensive
        const byPrice = augmentations.slice().sort(by(aug=>-augmentationPrices[aug]));
        for (const augmentation of byPrice)
            for (const faction of factions)
                ns.purchaseAugmentation(faction, augmentation);

        // Spend what's left on Neuroflux
        const neuroFluxFaction = factions
            .filter(faction=>factionAugmentations[faction].includes(NEUROFLUX))
            .reduce((a,b)=>ns.getFactionRep(a)>ns.getFactionRep(b)?a:b);
        while (ns.purchaseAugmentation(neuroFluxFaction, NEUROFLUX));

        // Buy RAM if we can
        await rmi(ns)('/bin/self/buy-ram.js', 1);
        await rmi(ns)('/bin/self/aug/install.js', 1, 'init.js');
    }

    putPlayerData(ns, { purchasedAugmentations, remainingAugs, timeToAug });
}

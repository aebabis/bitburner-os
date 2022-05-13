import {
    getStaticData,
    getPlayerData,
    putPlayerData,
    putMoneyData
} from './lib/data-store';
import { disableService } from './lib/service-api';
import { rmi } from './lib/rmi';
import { by } from './lib/util';

const NEUROFLUX = 'NeuroFlux Governor';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const { factions } = ns.getPlayer();
    const {
        augmentations,
        augmentationPrices,
        augmentationRepReqs,
        factionAugmentations,
        ownedAugmentations,
        augmentationPrereqs,
        targetAugmentations,
    } = getStaticData(ns);
    const { purchasedAugmentations } = getPlayerData(ns);

    const remainingAugs = targetAugmentations
        .filter(aug => !purchasedAugmentations.includes(aug))
        .sort(by(aug => -augmentationRepReqs[aug]))
        .sort(by(aug => -augmentationPrices[aug]));

    const purchasable = aug => (augmentationPrereqs[aug] || [])
        .every(prereq => purchasedAugmentations.includes(prereq));

    for (const augmentation of remainingAugs) {
        const soldTheAug = faction => ns.purchaseAugmentation(faction, augmentation);
        if (purchasable(augmentation)) {
            // Attempt to buy the next augmentation from any faction.
            // Only count the ones for which the prereqs are met.
            if (factions.some(soldTheAug)) {
                purchasedAugmentations.push(augmentation);
                remainingAugs.splice(remainingAugs.indexOf(augmentation), 1);
            } else {
                // If we can't buy the next augmentation, stop.
                break;
            }
        }
    }

    const queuedAugmentations = purchasedAugmentations.filter(aug => !ownedAugmentations.includes(aug));
    let multiplier = 1.9**queuedAugmentations.length;
    let costToAug = 0;
    const costOfNextAugmentation = remainingAugs.find(purchasable) * multiplier || null;
    for (const augmentation of remainingAugs) {
        costToAug += multiplier * augmentationPrices[augmentation];
        multiplier *= 1.9;
    }
    putMoneyData(ns, { costToAug, costOfNextAugmentation });

    if (remainingAugs.every(aug => purchasedAugmentations.includes(aug))) {
        // Prevent money from being spent
        disableService('hacknet');
        disableService('market-access');
        disableService('server-purchaser');
        disableService('tor');

        // Sell stocks
        if (ns.getPlayer().hasTixApiAccess)
            await rmi(ns)('/bin/broker.js', 1, 'dump');
        
        // Wait for a little more money to come in
        await ns.sleep(30000);

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

        // Start all over
        await rmi(ns)('/bin/self/aug/install.js', 1, 'init.js');
    }

    putPlayerData(ns, { purchasedAugmentations, remainingAugs });
}

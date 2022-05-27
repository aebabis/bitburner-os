import {
    getMoneyData,
    putMoneyData,
    getPlayerData,
    putPlayerData,
    getStaticData,
} from './lib/data-store';
import { rmi } from './lib/rmi';
import { by } from './lib/util';
import { liquidate } from './bin/liquidate';

const NEUROFLUX = 'NeuroFlux Governor';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const { factions, money } = ns.getPlayer();
    const {
        augmentations,
        augmentationPrices,
        augmentationRepReqs,
        ownedAugmentations,
        augmentationPrereqs,
        targetFaction,
        targetAugmentations,
    } = getStaticData(ns);
    const { purchasedAugmentations, factionRep={} } = getPlayerData(ns);
    const { estimatedStockValue=0, costToAug: augCost=Infinity } = getMoneyData(ns);

    const rep = factionRep[targetFaction] || 0;

    const remainingAugs = targetAugmentations
        .filter(aug => !purchasedAugmentations.includes(aug))
        .sort(by(aug => -augmentationRepReqs[aug]))
        .sort(by(aug => -augmentationPrices[aug]));

    const purchasable = aug => (augmentationPrereqs[aug] || [])
        .every(prereq => purchasedAugmentations.includes(prereq));

    const hasEnoughRep = remainingAugs.every(aug => rep >= augmentationRepReqs[aug]);
    const hasEnoughMoney = .9 * estimatedStockValue + money > augCost;
    // If our networth is enough to finish the run, do it.
    if (hasEnoughRep && hasEnoughMoney)
        await liquidate(ns);

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
        // Sell stocks and prevent spending
        await liquidate(ns);

        // Wait for a little more money to come in
        await ns.sleep(10000);

        // Attempt to buy as many faction augmentations
        // as possible, starting with the most expensive
        const byPrice = augmentations.slice().sort(by(aug=>-augmentationPrices[aug]));
        for (const augmentation of byPrice)
            for (const faction of factions)
                ns.purchaseAugmentation(faction, augmentation);

        // Spend what's left on Neuroflux
        while (factions.some(faction => ns.purchaseAugmentation(faction, NEUROFLUX)));

        // Buy RAM if we can
        await rmi(ns)('/bin/self/buy-ram.js', 1);

        // Try to start next aug with market access
        await rmi(ns)('/broker/purchase.js', 'purchaseWseAccount');
        await rmi(ns)('/broker/purchase.js', 'purchaseTixApi');
        await rmi(ns)('/broker/purchase.js', 'purchase4SMarketDataTixApi');
        await rmi(ns)('/broker/purchase.js', 'purchase4SMarketData');

        // Start all over
        await rmi(ns)('/bin/self/aug/install.js', 1, 'init.js');
    }

    putPlayerData(ns, { purchasedAugmentations, remainingAugs });
}
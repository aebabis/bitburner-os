import { STORY_FACTIONS, CITY_FACTIONS } from './bin/self/aug/factions';
import { getStaticData, putStaticData, getPlayerData  } from './lib/data-store';
import { table } from './lib/table';
import { report } from './lib/logger';

export const analyzeAugData = async (ns) => {
    const {
        factionAugmentations,
        augmentationPrices,
        augmentationRepReqs,
    } = getStaticData(ns);
    const {
        purchasedAugmentations
    } = getPlayerData(ns);

    // Currently only allowing story and city
    // factions for automatic work and aug purchases
    const factions = [...STORY_FACTIONS, ...CITY_FACTIONS];

    const possibleTargets = [];
    const neededAugmentations = {};
    const maxAugPrices = {};
    const maxRepReqs = {};
    const reverse = {};

    const mostSpent = Math.max(0, ...purchasedAugmentations.map(aug =>
        augmentationPrices[aug]));

    ns.tprint('Cost of most expensive aug purchased: $' + mostSpent);

    // Go through all 
    for (const faction of factions) {
        const augmentations = factionAugmentations[faction];
        // Get a list of unowned augmentations for this faction,
        // not including NeuroFlux Governor
        const needed = augmentations
            .filter(aug => aug !== 'NeuroFlux Governor')
            .filter(aug => !purchasedAugmentations.includes(aug));
        neededAugmentations[faction] = needed;

        for (const augmentation of needed) {
            if (reverse[augmentation] == null)
                reverse[augmentation] = [faction];
            else
                reverse[augmentation].push(faction);
        }
    }

    const exclusives = {};

    // Determine "exclusives", augmentations that can only be
    // purchased through a single faction.
    for (const faction of factions) {
        const needed = neededAugmentations[faction];
        const factionExclusives = needed.filter(aug => reverse[aug].length === 1);
        exclusives[faction] = factionExclusives;

        if (needed.length > 0)
            possibleTargets.push(faction);

        // Record the maximum required reputation for this faction
        maxAugPrices[faction] = Math.max(0, ...needed.map(aug=>augmentationPrices[aug]));
        maxRepReqs[faction] = Math.max(0, ...needed.map(aug=>augmentationRepReqs[aug]));
    }

    let rows = [];
    for (const faction of factions) {
        rows.push([faction, '', '']);
        for (const aug of neededAugmentations[faction])
            rows.push([aug, augmentationPrices[aug], augmentationRepReqs[aug]]);
        rows.push(['', '', '']);
    }
    report(ns, 'augs.txt', table(ns, null, rows), 'w');

    ns.tprint('REMAINING AUGS');
    for (const [k, v] of Object.entries(exclusives)) {
        if (v.length > 0)
            ns.tprint(k + ': ' + v.join(', '));
    }

    let targetFaction = null;
    if (possibleTargets.length)
        targetFaction = possibleTargets.reduce((a, b) => maxRepReqs[a] < maxRepReqs[b] ? a : b);
    const cityFaction = CITY_FACTIONS.find(faction => exclusives[faction].length > 0);

    putStaticData(ns, {
        targetFaction,
        cityFaction,
        neededAugmentations,
        maxAugPrices,
        maxRepReqs,
    });
};

/** @param {NS} ns */
export async function main(ns) {
    await analyzeAugData(ns);
}

import { STORY_FACTIONS, CITY_FACTIONS } from './bin/self/aug/factions';
import { getStaticData, putStaticData  } from './lib/data-store';

export const analyzeAugData = (ns) => {
    const {
        ownedAugmentations,
        factionAugmentations,
        augmentationPrices,
        augmentationRepReqs,
    } = getStaticData(ns);

    // Currently only allowing story and city
    // factions for automatic work and aug purchases
    const factions = [...STORY_FACTIONS, ...CITY_FACTIONS];

    const possibleTargets = [];
    const neededAugmentations = {};
    const maxAugPrices = {};
    const maxRepReqs = {};

    // Go through all 
    for (const faction of factions) {
        const augmentations = factionAugmentations[faction];
        // Get a list of unowned augmentations for this faction,
        // not including NeuroFlux Governor
        const needed = augmentations
            .filter(aug => aug !== 'NeuroFlux Governor')
            .filter(aug => !ownedAugmentations.includes(aug));
        neededAugmentations[faction] = needed;

        if (needed.length > 0)
            possibleTargets.push(faction);

        // Record the maximum required reputation for this faction
        maxAugPrices[faction] = Math.max(0, ...needed.map(aug=>augmentationPrices[aug]));
        maxRepReqs[faction] = Math.max(0, ...needed.map(aug=>augmentationRepReqs[aug]));
    }

    const targetFaction = possibleTargets.reduce((a, b) => maxRepReqs[a] < maxRepReqs[b] ? a : b, 'Daedalus');
    const cityFaction = CITY_FACTIONS.find(faction => neededAugmentations[faction].length > 0);

    ns.tprint('CITY FACTION:   ' + cityFaction + ': ' + neededAugmentations[cityFaction].join(', '));
    ns.tprint('TARGET FACTION: ' + targetFaction + ': ' + neededAugmentations[targetFaction].join(', '));

    putStaticData(ns, {
        targetFaction,
        cityFaction,
        neededAugmentations,
        maxAugPrices,
        maxRepReqs,
    });
}

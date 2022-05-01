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
    const reverse = {};

    // Go through all 
    for (const faction of factions) {
        const augmentations = factionAugmentations[faction];
        // Get a list of unowned augmentations for this faction,
        // not including NeuroFlux Governor
        const needed = augmentations
            .filter(aug => aug !== 'NeuroFlux Governor')
            .filter(aug => !ownedAugmentations.includes(aug));
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

        if (factionExclusives.length > 0)
            possibleTargets.push(faction);

        // Record the maximum required reputation for this faction
        maxAugPrices[faction] = Math.max(0, ...factionExclusives.map(aug=>augmentationPrices[aug]));
        maxRepReqs[faction] = Math.max(0, ...factionExclusives.map(aug=>augmentationRepReqs[aug]));
    }

    for (const [k, v] of Object.entries(exclusives)) {
        ns.tprint(k + ': ' + v.join(', '));
    }

    const targetFaction = possibleTargets.reduce((a, b) => maxRepReqs[a] < maxRepReqs[b] ? a : b, 'Daedalus');
    const cityFaction = CITY_FACTIONS.find(faction => exclusives[faction].length > 0);

    ns.tprint('CITY FACTION:   ' + cityFaction + ': ' + exclusives[cityFaction].join(', '));
    ns.tprint('TARGET FACTION: ' + targetFaction + ': ' + exclusives[targetFaction].join(', '));

    putStaticData(ns, {
        targetFaction,
        cityFaction,
        neededAugmentations,
        maxAugPrices,
        maxRepReqs,
    });
}

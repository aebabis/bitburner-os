import { STORY_FACTIONS, CITY_FACTIONS } from './bin/self/aug/factions';
import { getStaticData, putStaticData, getPlayerData  } from './lib/data-store';
import { table } from './lib/table';
import { report } from './lib/logger';
import { by } from './lib/util';

export const analyzeAugData = async (ns) => {
    const {
        factionAugmentations,
        augmentationPrices,
        augmentationRepReqs,
        ownedAugmentations,
    } = getStaticData(ns);
    const {
        purchasedAugmentations
    } = getPlayerData(ns);

    // Currently only allowing story and city
    // factions for automatic work and aug purchases
    const factions = [...STORY_FACTIONS, ...CITY_FACTIONS];

    const possibleTargets = [];
    const neededAugmentations = {};
    const viableAugmentations = {};
    const maxRepReqs = {};
    const reverse = {};

    const mostSpent = Math.max(0, ...ownedAugmentations.map(aug =>
        augmentationPrices[aug]));
    const baseAugPriceThreshold = mostSpent * 2 || 10e6;
    const isViable = aug => augmentationPrices[aug] <= baseAugPriceThreshold;

    // If script is restarting/rebooting, there is
    // a possibility that the player has already
    // joined a city faction. Most of the time,
    // this will be null.
    let cityFaction = ns.getPlayer().factions
        .find(faction=>CITY_FACTIONS.includes(faction));

    ns.tprint('Cost of most expensive aug purchased: $' + mostSpent);

    // Go through all 
    for (const faction of factions) {
        const augmentations = factionAugmentations[faction];

        const needed = augmentations
            .filter(aug => aug !== 'NeuroFlux Governor')
            .filter(aug => !purchasedAugmentations.includes(aug));
        neededAugmentations[faction] = needed;

        const viable = needed.filter(isViable);
        viableAugmentations[faction] = viable;
        const isCityFaction = CITY_FACTIONS.includes(faction);
        const isExcluded = isCityFaction && cityFaction != null && cityFaction !== faction;
        if (viable.length > 0 && !isExcluded)
            possibleTargets.push(faction);

        for (const augmentation of augmentations) {
            if (reverse[augmentation] == null)
                reverse[augmentation] = [];
            reverse[augmentation].push(faction);
        }
    }

    const exclusives = {}; // Unique augs by faction

    const mapRep = augs => Math.max(0, ...augs.filter(isViable).map(aug=>augmentationRepReqs[aug]));

    for (const faction of factions) {
        const needed = neededAugmentations[faction];
        const factionExclusives = needed.filter(aug => reverse[aug].length === 1);
        exclusives[faction] = factionExclusives;
        maxRepReqs[faction] = mapRep(needed);
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
    let repNeeded;
    let targetAugmentations;
    if (possibleTargets.length) {
        const gang = ns.gang.inGang() && ns.gang.getGangInformation().faction;
        if (gang && possibleTargets.includes(gang)) {
            targetFaction = gang;
            targetAugmentations = factionAugmentations[targetFaction]
                .sort(by(aug => augmentationPrices[aug]))
                .filter(aug => aug !== 'NeuroFlux Governor')
                .filter(aug => !purchasedAugmentations.includes(aug))
                .filter(isViable)
                .slice(0, 6);
            repNeeded = mapRep(targetAugmentations);
        } else {
            targetFaction = possibleTargets.reduce((a, b) => maxRepReqs[a] < maxRepReqs[b] ? a : b);
            repNeeded = maxRepReqs[targetFaction];
            targetAugmentations = viableAugmentations[targetFaction];
        }
    }
    if (cityFaction == null)
        cityFaction = CITY_FACTIONS.find(faction => exclusives[faction].length > 0);

    putStaticData(ns, {
        targetFaction,
        cityFaction,
        neededAugmentations,
        repNeeded,
        targetAugmentations,
    });
};

/** @param {NS} ns */
export async function main(ns) {
    await analyzeAugData(ns);
}

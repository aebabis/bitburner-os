import {
    STORY_FACTIONS,
    CITY_FACTIONS,
    AUGMENTATION_REQUIREMENTS,
    COMBAT_REQUIREMENTS,
} from './bin/self/aug/factions';
import { getStaticData, putStaticData, getPlayerData  } from './lib/data-store';
// import { table } from './lib/table';
// import { report } from './lib/logger';
import { by } from './lib/util';

const dont = func => b => !func(b);
const notNeuroFlux = aug => aug !== 'NeuroFlux Governor';

const process = (factions, factionAugmentations, purchasedAugmentations) => {
    const haveIt = aug => purchasedAugmentations.includes(aug);
    const neededAugmentations = {};
    const reverse = {};
    for (const faction of factions) {
        const augmentations = factionAugmentations[faction];

        neededAugmentations[faction] = augmentations
            .filter(dont(haveIt))
            .filter(notNeuroFlux);

        for (const augmentation of augmentations) {
            if (reverse[augmentation] == null)
                reverse[augmentation] = [];
            reverse[augmentation].push(faction);
        }
    }

    const factionExclusives = {}; // Unique augs by faction

    for (const faction of factions) {
        const needed = neededAugmentations[faction];
        factionExclusives[faction] = needed.filter(aug => reverse[aug].length === 1);
    }
    return { neededAugmentations, factionExclusives };
};

function isCombatReady(factions, factionAugmentations, purchasedAugmentations) {
    const haveIt = aug => purchasedAugmentations.includes(aug);
    const preEndMap = {};
    const preEndFactions = factions.filter(faction => !COMBAT_REQUIREMENTS[faction]);
    for (const preEndFaction of preEndFactions)
        for (const augmentation of factionAugmentations[preEndFaction])
            preEndMap[augmentation] = true;

    const preEndAugs = Object.keys(preEndMap);
    const hasAllPreEnd = preEndAugs.every(haveIt);
    return hasAllPreEnd;
}

const selectTargetFaction = (ns, factions, neededAugmentations, factionAllowed, augViable) => {
    if (ns.gang.inGang())
        return ns.gang.getGangInformation().faction;
    
    if (neededAugmentations['Netburners'].length > 0)
        return 'Netburners';
    
    if (neededAugmentations['CyberSec'].length > 0)
        return 'CyberSec';

    const possibleFactions = factions.filter(factionAllowed);

    return possibleFactions.map(faction => ({
        faction,
        viableAugs: neededAugmentations[faction].filter(augViable),
    })).reduce((a, b) => a.viableAugs.length >= b.viableAugs.length ? a : b).faction;
};

export const analyzeAugData = async (ns) => {
    const {
        factionAugmentations,
        augmentationPrices,
        // augmentationRepReqs,
        ownedAugmentations,
    } = getStaticData(ns);
    const {
        purchasedAugmentations
    } = getPlayerData(ns);

    // Currently only allowing story and city
    // factions for automatic work and aug purchases
    const factions = [...STORY_FACTIONS, ...CITY_FACTIONS];

    const { neededAugmentations, factionExclusives } = process(factions, factionAugmentations, purchasedAugmentations);

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

    const hasAllPreEnd = isCombatReady(factions, factionAugmentations, purchasedAugmentations);

    const targetFaction = selectTargetFaction(ns, factions, neededAugmentations, (faction) => {
        const requiredAugCount = AUGMENTATION_REQUIREMENTS[faction] || 0;
        if(ownedAugmentations.length < requiredAugCount)
            return false;
        const isCityFaction = CITY_FACTIONS.includes(faction);
        if (isCityFaction && cityFaction != null && cityFaction !== faction)
            return false;
        return hasAllPreEnd || COMBAT_REQUIREMENTS[faction] == null;
    }, isViable);

    ns.tprint(targetFaction);
    const targetAugmentations = neededAugmentations[targetFaction]
        .sort(by(aug => augmentationPrices[aug]))
        // .filter(isViable)
        .slice(0, 6);
    if (cityFaction == null)
        cityFaction = CITY_FACTIONS.find(faction => factionExclusives[faction].length > 0);

    putStaticData(ns, {
        targetFaction,
        cityFaction,
        targetAugmentations,
    });
};

/** @param {NS} ns */
export async function main(ns) {
    await analyzeAugData(ns);
}

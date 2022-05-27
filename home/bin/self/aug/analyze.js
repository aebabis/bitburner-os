import {
    STORY_FACTIONS,
    CITY_FACTIONS,
    AUGMENTATION_REQUIREMENTS,
} from './bin/self/aug/factions';
import { getStaticData, putStaticData  } from './lib/data-store';
import { by } from './lib/util';

// If doing multiple factions, consider sum of max repreqs
const getAugmentGoals = (ownedAugmentations, {
  augmentations,
  augmentationPrices,
  augmentationRepReqs,
  augmentationPrereqs,
  factionAugmentations,
}, cityFaction) => {
  const MAX_AUGS = 6;
  const NEUROFLUX = 'NeuroFlux Governor';
  const MONEY_PER_REP = 4000; // This will vary at some point
  
  const notNeuroFlux = aug => aug !== NEUROFLUX;
  const stillNeeds = aug => !ownedAugmentations.includes(aug);
  const weightedCost = aug=>Math.max(augmentationPrices[aug]/MONEY_PER_REP,
                             augmentationRepReqs[aug]);

  const factions = [...STORY_FACTIONS, ...CITY_FACTIONS].filter((faction) => {
    const requiredAugCount = AUGMENTATION_REQUIREMENTS[faction] || 0;
    if(ownedAugmentations.length < requiredAugCount)
        return false;
    const isCityFaction = CITY_FACTIONS.includes(faction);
    if (isCityFaction && cityFaction != null && cityFaction !== faction)
        return false;
    // return hasAllPreEnd || COMBAT_REQUIREMENTS[faction] == null;
  });
  const getNeededAugs = faction => factionAugmentations[faction]
      .filter(stillNeeds).filter(notNeuroFlux);
  const getPurchaseOrder = (augs) => {
    const order = new Set([]);
    augs.sort(by(aug=>-augmentationPrices[aug]));
    for (const aug of augs) {
      const prereqs = augmentationPrereqs[aug]
        .filter(stillNeeds)
        .reverse();
      for (const prereq of prereqs)
        order.add(prereq);
      order.add(aug);
    }
    return [...order].splice(0, MAX_AUGS);
  };
  
  for (const faction of ['Netburners', 'CyberSec']) {
    const needed = getNeededAugs(faction);
    if (needed.length)
      return {
        faction,
        augmentations: getPurchaseOrder(needed)
      };
  }
    
  const unownedAugmentations = augmentations
    .filter(aug => !ownedAugmentations.includes(aug) && notNeuroFlux(aug))
    .sort(by(weightedCost));
  
  const top = unownedAugmentations.slice(0, 4);
  const faction = factions.reduce((a,b)=> {
    const numA = getNeededAugs(a).filter(aug=>top.includes(aug)).length;
    const numB = getNeededAugs(b).filter(aug=>top.includes(aug)).length;
    if (numA >= numB)
      return a;
    return b;
  });
  const augs = factionAugmentations[faction]
    .filter(stillNeeds)
    .filter(notNeuroFlux)
    .slice(0, MAX_AUGS)
    .sort(by(aug=>-weightedCost(aug)));
  while (augs.length > 1 && weightedCost(augs[0]) > weightedCost(augs[1])*10)
    augs.shift();
  if (augs.length)
    return { faction, augmentations: getPurchaseOrder(augs) };
  return { faction: null,
          augmentations: getPurchaseOrder(unownedAugmentations.slice(0, MAX_AUGS)) };
};

export const analyzeAugData = async (ns) => {
    const augData = getStaticData(ns);
    const cityFaction = ns.getPlayer().factions.find(faction=>CITY_FACTIONS.includes(faction));
    const augGoals = getAugmentGoals(augData.ownedAugmentations, augData, cityFaction);

    putStaticData(ns, {
        targetFaction: augGoals.faction,
        // cityFaction,
        targetAugmentations: augGoals.augmentations,
    });
};

/** @param {NS} ns */
export async function main(ns) {
    await analyzeAugData(ns);
}

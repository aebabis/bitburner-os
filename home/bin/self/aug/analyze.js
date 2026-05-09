import {
  STORY_FACTIONS,
  CITY_FACTIONS,
  AUGMENTATION_REQUIREMENTS,
} from "./factions";
import { getStaticData, putStaticData } from "../../../lib/data-store";
import { by } from "../../../lib/util";

// If doing multiple factions, consider sum of max repreqs
const getAugmentGoals = (
  /** @type {string[]} */ ownedAugmentations,
  /** @type {{augmentations: string[], augmentationPrices: Record<string,number>, augmentationRepReqs: Record<string,number>, augmentationPrereqs: Record<string,string[]>, factionAugmentations: Record<string,string[]>}} */
  {
    augmentations,
    augmentationPrices,
    augmentationRepReqs,
    augmentationPrereqs,
    factionAugmentations,
  },
  /** @type {string | undefined} */ cityFaction,
) => {
  const MAX_AUGS = 6;
  const NEUROFLUX = "NeuroFlux Governor";
  const MONEY_PER_REP = 4000; // This will vary at some point

  const notNeuroFlux = (/** @type {string} */ aug) => aug !== NEUROFLUX;
  const stillNeeds = (/** @type {string} */ aug) => !ownedAugmentations.includes(aug);
  const weightedCost = (/** @type {string} */ aug) =>
    Math.max(augmentationPrices[aug] / MONEY_PER_REP, augmentationRepReqs[aug]);

  const factions = [...STORY_FACTIONS, ...CITY_FACTIONS].filter((faction) => {
    const requiredAugCount = (/** @type {Record<string,number>} */ (AUGMENTATION_REQUIREMENTS))[faction] || 0;
    if (ownedAugmentations.length < requiredAugCount) return false;
    const isCityFaction = CITY_FACTIONS.includes(faction);
    if (isCityFaction && cityFaction != null && cityFaction !== faction)
      return false;
    return true;
    // return hasAllPreEnd || COMBAT_REQUIREMENTS[faction] == null;
  });
  const getNeededAugs = (/** @type {string} */ faction) =>
    factionAugmentations[faction].filter(stillNeeds).filter(notNeuroFlux);
  const getPurchaseOrder = (/** @type {string[]} */ augs) => {
    const order = new Set(/** @type {string[]} */([]));

    augs.sort(by((/** @type {string} */ aug) => -augmentationPrices[aug]));
    for (const aug of augs) {
      const prereqs = augmentationPrereqs[aug].filter(stillNeeds).reverse();
      for (const prereq of prereqs) order.add(prereq);
      order.add(aug);
    }
    return [...order].splice(0, MAX_AUGS);
  };

  for (const faction of ["Netburners", "CyberSec"]) {
    const needed = getNeededAugs(faction);
    if (needed.length)
      return {
        faction,
        augmentations: getPurchaseOrder(needed),
      };
  }

  const unownedAugmentations = augmentations
    .filter((/** @type {string} */ aug) => !ownedAugmentations.includes(aug) && notNeuroFlux(aug))
    .filter((aug) => factions.some((faction) => factionAugmentations[faction].includes(aug)))
    .sort(by(weightedCost));

  const top = unownedAugmentations.slice(0, 4);
  const faction = factions.reduce((/** @type {string} */ a, /** @type {string} */ b) => {
    const numA = getNeededAugs(a).filter((/** @type {string} */ aug) => top.includes(aug)).length;
    const numB = getNeededAugs(b).filter((/** @type {string} */ aug) => top.includes(aug)).length;
    if (numA >= numB) return a;
    return b;
  });
  const augs = factionAugmentations[faction]
    .filter(stillNeeds)
    .filter(notNeuroFlux)
    .slice(0, MAX_AUGS)
    .sort(by((/** @type {string} */ aug) => -weightedCost(aug)));
  while (augs.length > 1 && weightedCost(augs[0]) > weightedCost(augs[1]) * 10)
    augs.shift();
  if (augs.length) return { faction, augmentations: getPurchaseOrder(augs) };
  return {
    faction: null,
    augmentations: getPurchaseOrder(unownedAugmentations.slice(0, MAX_AUGS)),
  };
};

/** @param {NS} ns */
export const analyzeAugData = async (ns) => {
  const augData = getStaticData(ns);
  const cityFaction = ns
    .getPlayer()
    .factions.find((faction) => CITY_FACTIONS.includes(faction));
  const augGoals = getAugmentGoals(
    augData.ownedAugmentations,
    augData,
    cityFaction,
  );

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

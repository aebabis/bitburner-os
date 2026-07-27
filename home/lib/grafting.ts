import { getAugEvaluator } from './aug-weights';
import { getStaticData } from './data-store';

export const VIOLET = 'violet Congruity Implant';

export const getGraftTargets = (ns: NS, ownedAugs: Map<string, number>, entropy: number) => {
  const entropyMult = ownedAugs.has(VIOLET) ? 1 : 0.98 ** (entropy + 1);
  const {
    resetInfo,
    augmentationStats,
    graftableAugmentations = [],
    augmentationGraftPrices,
    augmentationGraftTimes,
    augmentations,
  } = getStaticData(ns);
  const scoreAug = getAugEvaluator(resetInfo, augmentationStats);
  if (scoreAug == null) return [];
  return augmentations
    .filter((aug) => !ownedAugs.has(aug.name))
    .filter((aug) => graftableAugmentations.includes(aug.name))
    .filter((augmentation) => augmentation.prereqs.every((aug) => ownedAugs.has(aug)))
    .map((augmentation) => {
      const value = scoreAug(augmentation.name);
      const graftPrice = augmentationGraftPrices[augmentation.name];
      const graftTime = augmentationGraftTimes[augmentation.name];
      const baseUtility = (1e3 * value) / (graftTime / 1000);
      const utility = augmentation.name === VIOLET ? baseUtility : baseUtility * entropyMult;
      return { augmentation, value, utility, graftPrice, graftTime };
    })
    .sort((a, b) => b.utility - a.utility);
};

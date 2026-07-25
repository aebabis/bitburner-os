import { getAugEvaluator } from './aug-weights';
import { getStaticData } from './data-store';

export const getGraftTargets = (ns: NS, ownedAugs: Map<string, number>) => {
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
      return {
        augmentation,
        value,
        utility: (1e6 * value) / graftTime,
        graftPrice,
        graftTime,
      };
    })
    .sort((a, b) => b.utility - a.utility);
};

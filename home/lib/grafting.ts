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
    .filter((aug) => graftableAugmentations.includes(aug.name))
    .filter((augmentation) => augmentation.prereqs.every((aug) => ownedAugs.has(aug)))
    .map((augmentation) => ({
      augmentation,
      utility: scoreAug(augmentation.name),
      graftPrice: augmentationGraftPrices[augmentation.name],
      graftTime: augmentationGraftTimes[augmentation.name],
    }))
    .sort((a, b) => b.utility - a.utility);
};

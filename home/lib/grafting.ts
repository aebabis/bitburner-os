import { getAugEvaluator } from './aug-weights';
import { Augmentation, getStaticData } from './data-store';

const isGraftTarget = (augmentation: Augmentation, resetInfo: ResetInfo) => {
  if (augmentation.factions.length <= 1) return true;
  const stats = Object.entries(augmentation.stats);
  if (resetInfo.currentNode === 15) {
    return stats.some(([name, value]) => name.includes('cha') && value > 1);
  } else {
    return stats.some(([name, value]) => name.includes('hack') && value > 1);
  }
};

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
    .filter((augmentation) => isGraftTarget(augmentation, resetInfo))
    .filter((augmentation) => augmentation.prereqs.every((aug) => ownedAugs.has(aug)))
    .map((augmentation) => ({
      augmentation,
      utility: scoreAug(augmentation.name),
      graftPrice: augmentationGraftPrices[augmentation.name],
      graftTime: augmentationGraftTimes[augmentation.name],
    }))
    .sort((a, b) => b.utility - a.utility);
};

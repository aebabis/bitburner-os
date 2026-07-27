import { getAugEvaluator, getEntropyCost, VIOLET } from './aug-weights';
import { getStaticData } from './data-store';

export { VIOLET };

export const getGraftTargets = (ns: NS, ownedAugs: Map<string, number>, entropy: number) => {
  const {
    resetInfo,
    augmentationStats,
    graftableAugmentations = [],
    augmentationGraftPrices,
    augmentationGraftTimes,
    augmentations,
  } = getStaticData(ns);
  const scoreAug = getAugEvaluator(resetInfo, augmentationStats, entropy);
  if (scoreAug == null) return [];

  // Grafting costs one entropy point, taxing every existing multiplier. Violet is exempt:
  // it clears accumulated entropy, and its gain is already priced by the evaluator.
  const entropyCost = getEntropyCost(resetInfo);

  return augmentations
    .filter((aug) => !ownedAugs.has(aug.name))
    .filter((aug) => graftableAugmentations.includes(aug.name))
    .filter((augmentation) => augmentation.prereqs.every((aug) => ownedAugs.has(aug)))
    .map((augmentation) => {
      const value = scoreAug(augmentation.name);
      const netValue = augmentation.name === VIOLET ? value : value - entropyCost;
      const graftPrice = augmentationGraftPrices[augmentation.name];
      const graftTime = augmentationGraftTimes[augmentation.name];
      const utility = (1e3 * netValue) / (graftTime / 1000);
      return { augmentation, value, netValue, utility, graftPrice, graftTime };
    })
    .sort((a, b) => b.utility - a.utility);
};

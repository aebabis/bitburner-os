import { vIOLET } from '../etc/augmentations';
import { getAugEvaluator, getEntropyCost } from './aug-weights';
import { getStaticData, PlayerData, StaticData } from './data-store';

type Graft = {
  augmentation: string;
  timeLeft: number;
};

/**
 * Gets currently grafted augmentation and the time remaining.
 */
export const getCurrentGraft = (staticData: StaticData, playerData: PlayerData): Graft | null => {
  const { currentWork } = playerData;
  if (currentWork?.type !== 'GRAFTING') return null;
  const { augmentation, cyclesWorked } = currentWork;
  const graftTime = staticData.graftingData!.augmentationGraftTimes[augmentation];
  const timeLeft = Math.max(0, graftTime - cyclesWorked * 200);
  return { augmentation, timeLeft };
};

export const getGraftTargets = (ns: NS, ownedAugs: Map<string, number>, entropy: number) => {
  const { resetInfo, singularityData, graftingData } = getStaticData(ns);
  // SF4 and SF10 data both needed to choose graft targets
  if (singularityData == null || graftingData == null) return [];
  const { augmentationStats, augmentations } = singularityData;
  const { graftableAugmentations, augmentationGraftPrices, augmentationGraftTimes } = graftingData;
  const scoreAug = getAugEvaluator(resetInfo, augmentationStats, entropy);
  if (scoreAug == null) return [];

  // Grafting costs one entropy point, taxing every existing multiplier. Violet is exempt:
  // it clears accumulated entropy, and its gain is already priced by the evaluator.
  const entropyCost = ownedAugs.has(vIOLET) ? 0 : getEntropyCost(resetInfo);

  return augmentations
    .filter((aug) => !ownedAugs.has(aug.name))
    .filter((aug) => graftableAugmentations.includes(aug.name))
    .filter((augmentation) => augmentation.prereqs.every((aug) => ownedAugs.has(aug)))
    .map((augmentation) => {
      const value = scoreAug(augmentation.name);
      const netValue = augmentation.name === vIOLET ? value : value - entropyCost;
      const graftPrice = augmentationGraftPrices[augmentation.name];
      const graftTime = augmentationGraftTimes[augmentation.name];
      const utility = (1e3 * netValue) / (graftTime / 1000);
      return { augmentation, value, netValue, utility, graftPrice, graftTime };
    })
    .sort((a, b) => b.utility - a.utility);
};

import {
  STORY_FACTIONS,
  CITY_FACTIONS,
} from "./factions";
import { getStaticData, putStaticData } from "../../../lib/data-store";
import { by } from "../../../lib/util";
import { scoreAug, augEffectiveCost, getMoneyPerRep, DEFAULT_AUG_WEIGHTS } from "../../../lib/aug-select";

const getAugmentGoals = (
  /** @type {string[]} */ ownedAugmentations,
  /** @type {{
    augmentationPrices: Record<string,number>,
    augmentationRepReqs: Record<string,number>,
    augmentationPrereqs: Record<string,string[]>,
    augmentationStats: Record<string,Multipliers>,
    factionAugmentations: Record<string,string[]>,
    factionRequirements: Record<string, PlayerRequirement[]>,
    bitNodeMultipliers: BitNodeMultipliers,
  }} */
  {
    augmentationPrices,
    augmentationRepReqs,
    augmentationPrereqs,
    augmentationStats = /** @type {Record<string,Multipliers>} */ ({}),
    factionAugmentations,
    factionRequirements,
    bitNodeMultipliers = /** @type {BitNodeMultipliers} */ ({}),
  },
  /** @type {string | undefined} */ cityFaction,
) => {
  const MAX_AUGS = 6;
  const NEUROFLUX = "NeuroFlux Governor";
  const moneyPerRep = getMoneyPerRep(bitNodeMultipliers.FactionWorkRepGain);

  const stillNeeds = (/** @type {string} */ aug) => !ownedAugmentations.includes(aug);
  const notNeuroFlux = (/** @type {string} */ aug) => aug !== NEUROFLUX;

  const accessibleFactions = [...STORY_FACTIONS, ...CITY_FACTIONS].filter((faction) => {
    const requiredAugCount =
      factionRequirements[faction]?.find((req) => req.type === "numAugmentations")
        ?.numAugmentations ?? 0;
    if (ownedAugmentations.length < requiredAugCount) return false;
    if (CITY_FACTIONS.includes(faction) && cityFaction != null && cityFaction !== faction)
      return false;
    return true;
  });

  const getNeededAugs = (/** @type {string} */ faction) =>
    (factionAugmentations[faction] ?? []).filter(stillNeeds).filter(notNeuroFlux);

  const augUtility = (/** @type {string} */ aug) => {
    const stats = augmentationStats[aug];
    const price = augmentationPrices[aug] ?? 0;
    const repReq = augmentationRepReqs[aug] ?? 0;
    const value = stats != null ? scoreAug(stats, DEFAULT_AUG_WEIGHTS) : 0;
    const cost = augEffectiveCost(price, repReq, moneyPerRep);
    return cost > 0 ? value / cost : 0;
  };

  const factionUtility = (/** @type {string} */ faction) =>
    getNeededAugs(faction)
      .map(augUtility)
      .sort((a, b) => b - a)
      .slice(0, MAX_AUGS)
      .reduce((sum, u) => sum + u, 0);

  const bestFaction = accessibleFactions.reduce(
    (best, faction) => {
      const u = factionUtility(faction);
      return u > best.utility ? { faction, utility: u } : best;
    },
    { faction: /** @type {string | null} */ (null), utility: -Infinity },
  ).faction;

  if (!bestFaction) return { faction: null, augmentations: [] };

  const getPurchaseOrder = (/** @type {string[]} */ augs) => {
    const order = new Set(/** @type {string[]} */([]));
    augs.sort(by((/** @type {string} */ aug) => -augmentationPrices[aug]));
    for (const aug of augs) {
      const prereqs = (augmentationPrereqs[aug] ?? []).filter(stillNeeds).reverse();
      for (const prereq of prereqs) order.add(prereq);
      order.add(aug);
    }
    return [...order].slice(0, MAX_AUGS);
  };

  const bestAugs = getNeededAugs(bestFaction)
    .sort((a, b) => augUtility(b) - augUtility(a))
    .slice(0, MAX_AUGS);

  return { faction: bestFaction, augmentations: getPurchaseOrder(bestAugs) };
};

/** @param {NS} ns */
export const analyzeAugData = (ns) => {
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
    targetAugmentations: augGoals.augmentations,
  });
};

/** @param {NS} ns */
export async function main(ns) {
  await analyzeAugData(ns);
}

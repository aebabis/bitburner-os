import { AugWeights, getAugEvaluator, scoreAug, statlessAugValue } from './aug-weights.ts';
import { SF4StaticData, StaticData } from './data-store.ts';
import { STORY_FACTIONS, CITY_FACTIONS, CRIMINAL_ORGANIZATIONS } from './factions.ts';
import { getMockFormulas, MockFormulas } from './formulas.ts';

// Seconds of reset overhead modeled for the first aug run; decreases as more augs are installed.
const OVERHEAD_BASE = 120 * 60;

export const computeResetOverhead = (staticData: StaticData) => {
  const installedAugs = staticData.installedAugmentations ?? [];
  const lastAugReset = staticData.resetInfo?.lastAugReset ?? 0;
  const timeSinceInstall = lastAugReset > 0 ? (Date.now() - lastAugReset) / 1000 : 0;
  return Math.max(timeSinceInstall, OVERHEAD_BASE / (1 + installedAugs.length));
};

// With queued augs the price multiplier is already inflated. Installing now resets it to 1,
// making the remaining augs cheaper. Rep persists through installs, so the main cost is
// re-leveling after reset. True if that reset cost is less than waiting for the full batch.
// TODO: use formulas to estimate re-leveling time and replace the constant.
const INSTALL_OVERHEAD_SEC = 60;

export const shouldEarlyInstall = (
  numQueued: number,
  numTargeted: number,
  costToAug: number,
  liquidAssets: number,
  totalIncome: number,
) => {
  if (numQueued === 0 || numTargeted === 0) return false;
  const timeToMoneyGoal =
    totalIncome > 0 ? Math.max(0, costToAug - liquidAssets) / totalIncome : Infinity;
  return timeToMoneyGoal > INSTALL_OVERHEAD_SEC;
};

export const MAX_AUGS = 6;
const NEUROFLUX = 'NeuroFlux Governor';

export const augValueFromStats = (
  augWeights: AugWeights,
  aug: string,
  augmentationStats?: Record<string, Multipliers>,
) => {
  const statless = statlessAugValue(aug, augWeights);
  if (statless != null) return statless;
  const stats = augmentationStats?.[aug];
  return stats != null ? scoreAug(stats, augWeights) : 0;
};

export const computeRepReq = (augs: string[], staticData: SF4StaticData) => {
  const { augmentationRepReqs } = staticData.singularityData;
  const nfBaseRep = augmentationRepReqs[NEUROFLUX] ?? 0;
  let nfLevelOffset = 0;
  return Math.max(
    ...augs.map((aug) =>
      aug === NEUROFLUX ? nfBaseRep * 1.14 ** nfLevelOffset++ : (augmentationRepReqs[aug] ?? 0),
    ),
    0,
  );
};

export const computeAugCost = (augs: string[], staticData: SF4StaticData, numQueued: number) => {
  const { augmentationPrices } = staticData.singularityData;
  const installedNFCount = staticData.resetInfo?.ownedAugs?.get(NEUROFLUX) ?? 0;
  let multiplier = 1.9 ** numQueued;
  let nfLevelOffset = installedNFCount;
  let cost = 0;
  for (const aug of augs) {
    const nfLevelMult = aug === NEUROFLUX ? 1.14 ** nfLevelOffset++ : 1;
    cost += multiplier * (augmentationPrices[aug] ?? 0) * nfLevelMult;
    multiplier *= 1.9;
  }
  return cost;
};

export const computeRepRate = (
  faction: FactionName,
  factionWorkTypes: Record<FactionName, FactionWorkType[]> | undefined,
  factionRep: Record<FactionName, number> | undefined,
  factionFavor: Record<FactionName, number> | undefined,
  player: Player,
  lastAugReset: number,
  formulas: MockFormulas | Formulas,
): number => {
  if (faction === 'Bladeburners') {
    const timeSinceInstall = lastAugReset > 0 ? (Date.now() - lastAugReset) / 1000 : 0;
    return (factionRep?.['Bladeburners'] ?? 0) / timeSinceInstall;
  }
  return Math.max(
    0,
    ...(factionWorkTypes?.[faction] ?? ['hacking']).map(
      (workType) =>
        formulas?.work.factionGains(player, workType, factionFavor?.[faction] ?? 0)?.reputation * 5,
    ),
  );
};

type AugmentationPurchase = {
  name: string;
  effectiveBasePrice: number;
  repReq: number;
  value: number;
};

const getPossiblePurchases = (
  faction: FactionName,
  staticData: SF4StaticData,
  ownedAugmentations: string[],
): AugmentationPurchase[] => {
  const { resetInfo, singularityData } = staticData;
  const {
    augmentationPrices,
    augmentationRepReqs,
    augmentationStats,
    augmentationPrereqs,
    factionAugmentations,
  } = singularityData;

  // Augs that can be used to meet prereqs
  const availableAugs = new Set([...ownedAugmentations, ...(factionAugmentations[faction] ?? [])]);
  const hasPrereqs = (aug: string) =>
    (augmentationPrereqs[aug] ?? []).every((req) => availableAugs.has(req));

  const stillNeeds = (aug: string) => !ownedAugmentations.includes(aug);
  const neededAugs = factionAugmentations[faction]
    .filter(stillNeeds)
    .filter((aug) => aug !== NEUROFLUX)
    .filter(hasPrereqs);

  const augValue = getAugEvaluator(resetInfo, augmentationStats) || (() => 0);

  const possiblePurchase = (aug: string, numInstalled = 0, numQueued = 0) => ({
    name: aug,
    value: augValue(aug),
    effectiveBasePrice: augmentationPrices[aug] * 1.14 ** (numInstalled + numQueued),
    repReq: augmentationRepReqs[aug] * 1.14 ** numQueued,
  });

  const installedNFCount = staticData.resetInfo?.ownedAugs?.get(NEUROFLUX) ?? 0;
  const possibleNfgPurchases = (factionAugmentations[faction] ?? []).includes(NEUROFLUX)
    ? Array.from({ length: MAX_AUGS }, (_, i) => possiblePurchase(NEUROFLUX, installedNFCount, i))
    : [];

  return [...neededAugs.map((aug) => possiblePurchase(aug)), ...possibleNfgPurchases].sort(
    (a, b) => a.repReq - b.repReq,
  );
};

export const findOptimalBatch = (
  faction: FactionName,
  staticData: SF4StaticData,
  player: Player,
  formulas: ReturnType<typeof getMockFormulas>,
  factionRep: Record<FactionName, number>,
  ownedAugmentations: string[],
  overhead: number,
  { moneyRate = Infinity, joinTime = 0 } = {},
) => {
  const { resetInfo, singularityData } = staticData;
  const { augmentationPrereqs, factionFavor, factionWorkTypes } = singularityData;

  const canDonate = (factionFavor?.[faction] ?? 0) >= (staticData.favorToDonate ?? Infinity);
  const donationRate = canDonate
    ? (formulas.reputation.donationForRep(1, player) ?? Infinity)
    : Infinity;

  // installedAugs determine the player's current stat multipliers.
  const installedAugs = staticData.installedAugmentations ?? [];

  const currentRep = factionRep[faction] ?? 0;
  const gainRate = computeRepRate(
    faction,
    factionWorkTypes,
    factionRep,
    factionFavor,
    player,
    resetInfo.lastAugReset,
    formulas,
  );

  const possiblePurchases = getPossiblePurchases(faction, staticData, ownedAugmentations);

  const getPurchaseOrder = (purchases: AugmentationPurchase[]) => {
    const purchasesRemaining = purchases.slice();
    const purchaseOrder = [];
    let i = 0; // Guard against weird prices excluding prereqs from batch
    // TODO: Implement a prereq-aware batch permuter below
    while (purchasesRemaining.length > 0 && ++i < 100) {
      const candidate = purchasesRemaining.shift()!;
      if (
        purchasesRemaining.some((other) =>
          (augmentationPrereqs[candidate.name] ?? []).includes(other.name),
        )
      ) {
        purchasesRemaining.push(candidate);
      } else {
        purchaseOrder.push(candidate);
      }
    }
    return purchaseOrder;
  };

  let best = { utility: 0, batch: [] as string[] };

  const numQueued = ownedAugmentations.length - installedAugs.length;

  for (let i = 0; i < possiblePurchases.length; i++) {
    const purchase = getPurchaseOrder(
      possiblePurchases
        .slice(0, i + 1)
        .sort((a, b) => b.value - a.value || a.effectiveBasePrice - b.effectiveBasePrice)
        .slice(0, MAX_AUGS)
        .sort((a, b) => b.effectiveBasePrice - a.effectiveBasePrice),
    );

    const totalValue = purchase.reduce((s, a) => s + a.value, 0);
    const totalPrice = purchase.reduce(
      (s, a, n) => s + a.effectiveBasePrice * 1.9 ** (numQueued + n),
      0,
    );
    const bindingRepCost = Math.max(...purchase.map((a) => a.repReq));
    const bindingRep = Math.max(0, bindingRepCost - currentRep);

    const effectivePrice = canDonate ? totalPrice + bindingRep * donationRate : totalPrice;
    const timeForMoney = Math.max(0, effectivePrice - (player.money ?? 0)) / moneyRate;
    const timeForRep = canDonate || bindingRep === 0 ? 0 : bindingRep / gainRate;
    const cost = joinTime + Math.max(timeForMoney, timeForRep) + overhead;
    const utility = totalValue / cost;

    if (utility > best.utility) best = { utility, batch: purchase.map((a) => a.name) };
  }

  return best;
};

/**
 * Returns true when a softReset to gain donation access (favor path) is faster than direct
 * rep grinding for the given faction and aug batch parameters.
 * augTimeWithFavor: t_favor + t_reset + t_N1 (favor grind → softReset → donate next cycle)
 * augTimeWithoutFavor: max(t_rep, t_money) (direct grind this cycle)
 */
export const shouldPursueFavor = (
  repRequired: number,
  augCost: number,
  currentRep: number,
  currentFavor: number,
  repRate: number,
  moneyRate: number,
  liquidAssets: number,
  player: Player,
  formulas: MockFormulas | Formulas,
  staticData: StaticData,
  overhead: number,
) => {
  const { favorToDonate } = staticData;
  if (favorToDonate == null || currentFavor >= favorToDonate) return false;
  if (!formulas?.reputation || !repRate || !moneyRate) return false;

  const pastRep = formulas.reputation.calculateFavorToRep(currentFavor);
  const totalNeededRep = formulas.reputation.calculateFavorToRep(favorToDonate);
  const repForFavor = totalNeededRep - pastRep;

  const donationRate = formulas.reputation.donationForRep(1, player);

  const tFavor = Math.max(0, repForFavor - currentRep) / repRate;
  const tReset = overhead;
  const tN1 = (repRequired * donationRate + augCost) / moneyRate;
  const augTimeWithFavor = tFavor + tReset + tN1;

  const augTimeWithoutFavor = Math.max(
    Math.max(0, repRequired - currentRep) / repRate,
    Math.max(0, augCost - liquidAssets) / moneyRate,
  );

  return augTimeWithFavor < augTimeWithoutFavor;
};

export const getAccessibleFactions = (
  staticData: SF4StaticData,
  player: Player,
  ownedAugmentations: string[],
) => {
  const { resetInfo, singularityData } = staticData;
  const { factionRequirements } = singularityData;
  return [
    ...STORY_FACTIONS,
    ...CRIMINAL_ORGANIZATIONS,
    ...CITY_FACTIONS,
    'Bladeburners' as FactionName,
  ].filter((faction) => {
    if (faction === 'Bladeburners' && !player.factions.includes('Bladeburners')) {
      return false;
    }
    if (faction === 'Netburners' && !(resetInfo.currentNode === 9 || resetInfo.ownedSF.has(9))) {
      return false;
    }
    const reqs = factionRequirements[faction] ?? [];
    const disqualifiers = reqs.filter((req) => req.type === 'not').map((req) => req.condition);
    const requiredAugCount =
      reqs.find((req) => req.type === 'numAugmentations')?.numAugmentations ?? 0;
    if (ownedAugmentations.length < requiredAugCount) return false;
    if (
      CITY_FACTIONS.includes(faction) &&
      player.factions?.find((other) => CITY_FACTIONS.includes(other) && other !== faction)
    )
      return false;
    if (disqualifiers.some((req) => req.type === 'employedBy' && player.jobs?.[req.company]))
      return false;
    if (
      reqs.some(
        (req) =>
          req.type === 'someCondition' && req.conditions.some((req) => req.type === 'jobTitle'),
      )
    ) {
      // TODO: Actually evaluate difficulty of obtaining job
      return false;
    }
    return true;
  });
};

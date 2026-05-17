import {
  getMoneyData,
  putMoneyData,
  getPlayerData,
  putPlayerData,
  getStaticData,
  getGoalsData,
} from "../../../lib/data-store";
import { getGoals, } from "../../../lib/goals";
import { rmi } from "../../../lib/rmi";
import { by } from "../../../lib/util";
import { liquidate } from "../../liquidate";

const NEUROFLUX = "NeuroFlux Governor";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  const { factions, money } = ns.getPlayer();
  const {
    augmentations,
    augmentationPrices,
    augmentationRepReqs,
    ownedAugmentations,
    augmentationPrereqs,
  } = getStaticData(ns);
  const goals = getGoals(ns);
  const targetAugmentations = goals
    .filter((goal) => goal.type === 'AUGMENTATION')
    .map((goal) => goal.desc);
  const targetFaction = goals.find((goal) => goal.type === 'FACTION_JOIN')?.faction;
  const { purchasedAugmentations, factionRep = {} } = getPlayerData(ns);
  const { estimatedStockValue = 0, costToAug: augCost = Infinity } =
    getMoneyData(ns);

  const gang = getPlayerData(ns).gangInfo?.faction;
  const gangRep = gang && factionRep[gang];
  const usedFaction = gangRep > factionRep[targetFaction] ? gang : targetFaction;
  const rep = factionRep[usedFaction] || 0;

  const remainingAugs = targetAugmentations
    .filter((/** @type {string} */ aug) => !purchasedAugmentations.includes(aug))
    .sort(by((/** @type {string} */ aug) => -augmentationRepReqs[aug]))
    .sort(by((/** @type {string} */ aug) => -augmentationPrices[aug]));

  const purchasable = (/** @type {string} */ aug) =>
    (augmentationPrereqs[aug] || []).every((/** @type {string} */ prereq) =>
      purchasedAugmentations.includes(prereq),
    );

  const hasEnoughRep = remainingAugs.every(
    (/** @type {string} */ aug) => rep >= augmentationRepReqs[aug],
  );
  const hasEnoughMoney = 0.9 * estimatedStockValue + money > augCost;
  // If our networth is enough to finish the run, do it.
  if (hasEnoughRep && hasEnoughMoney) await liquidate(ns);

  for (const augmentation of remainingAugs) {
    const soldTheAug = (/** @type {string} */ faction) =>
      ns.singularity.purchaseAugmentation(faction, augmentation);
    if (purchasable(augmentation)) {
      // Attempt to buy the next augmentation from any faction.
      // Only count the ones for which the prereqs are met.
      if (factions.some(soldTheAug)) {
        purchasedAugmentations.push(augmentation);
        remainingAugs.splice(remainingAugs.indexOf(augmentation), 1);
      } else {
        // If we can't buy the next augmentation, stop.
        break;
      }
    }
  }

  const queuedAugmentations = purchasedAugmentations.filter(
    (/** @type {string} */ aug) => !ownedAugmentations.includes(aug),
  );
  let multiplier = 1.9 ** queuedAugmentations.length;
  let costToAug = 0;
  for (const augmentation of remainingAugs) {
    costToAug += multiplier * augmentationPrices[augmentation];
    multiplier *= 1.9;
  }
  putMoneyData(ns, { costToAug });

  if (remainingAugs.every((/** @type {string} */ aug) => purchasedAugmentations.includes(aug))) {
    // Sell stocks and prevent spending
    await liquidate(ns);

    // Wait for a little more money to come in
    await ns.sleep(10000);

    // Attempt to buy as many faction augmentations
    // as possible, starting with the most expensive
    const byPrice = augmentations
      .slice()
      .sort(by((/** @type {string} */ aug) => -augmentationPrices[aug]));
    for (const augmentation of byPrice)
      for (const faction of factions)
        ns.singularity.purchaseAugmentation(faction, augmentation);

    // Spend what's left on Neuroflux
    while (
      factions.some((faction) =>
        ns.singularity.purchaseAugmentation(faction, NEUROFLUX),
      )
    );

    // Buy RAM if we can
    await rmi(ns)("/bin/self/buy-ram.js", 1);

    // Try to start next aug with market access
    await rmi(ns)("/bin/broker/purchase.js", 1, "purchaseWseAccount");
    await rmi(ns)("/bin/broker/purchase.js", 1, "purchaseTixApi");
    await rmi(ns)("/bin/broker/purchase.js", 1, "purchase4SMarketDataTixApi");
    await rmi(ns)("/bin/broker/purchase.js", 1, "purchase4SMarketData");

    // Start all over
    await rmi(ns)("/bin/self/aug/install.js", 1, "init.js");
  }

  putPlayerData(ns, { purchasedAugmentations });
}

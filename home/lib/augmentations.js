import { FACTIONS } from "../bin/self/aug/factions";
import { getStaticData } from "./data-store";
import { by } from "./util";

const NEUROFLUX = "NeuroFlux Governor";
const MONEY_PER_REP = 4000; // This will vary at some point

export class AugmentationInfo {
  /** @param {NS} ns */
  constructor(ns) {
    this.ns = ns;
    const {
      augmentations,
      augmentationPrices,
      augmentationRepReqs,
      augmentationPrereqs,
      factionAugmentations,
      ownedAugmentations,
    } = getStaticData(ns);
    this.augmentations = augmentations;
    this.augmentationPrices = augmentationPrices;
    this.augmentationRepReqs = augmentationRepReqs;
    this.augmentationPrereqs = augmentationPrereqs;
    this.factionAugmentations = factionAugmentations;
    this.ownedAugmentations = ownedAugmentations;
    this.unownedAugmentations = augmentations
      .filter((/** @type {string} */ aug) => this.isUnowned(aug))
      .sort(by((/** @type {string} */ aug) => this.weightedCost(aug)));

    const augmentationFactions = /** @type {Record<string, string[]>} */({});
    for (const faction of FACTIONS)
      for (const augmentation of factionAugmentations[faction])
        if (augmentationFactions[augmentation] == null)
          augmentationFactions[augmentation] = [faction];
        else augmentationFactions[augmentation].push(faction);

    this.augmentationFactions = augmentationFactions;
  }

  isUnowned = (/** @type {string} */ aug) =>
    !this.ownedAugmentations.includes(aug) && aug !== NEUROFLUX;

  weightedCost = (/** @type {string} */ aug) =>
    Math.max(
      this.augmentationPrices[aug] / MONEY_PER_REP,
      this.augmentationRepReqs[aug],
    );

  /** @param {string[]} augs @param {number} limit */
  getPurchaseOrder(augs, limit = Infinity) {
    const order = new Set(/** @type {string[]} */([]));
    augs.sort(by((aug) => -this.augmentationPrices[aug]));
    for (const aug of augs) {
      const prereqs = this.augmentationPrereqs[aug]
        .filter((aug) => this.isUnowned(aug))
        .reverse();
      for (const prereq of prereqs) order.add(prereq);
      order.add(aug);
    }
    return [...order].splice(0, limit);
  }

  /** @param {string[]} augs */
  getOrderCost(augs) {
    let mult = 1;
    let cost = 0;
    for (const aug of augs) {
      cost += this.augmentationPrices[aug] * mult;
      mult *= 1.9;
    }
    return cost;
  }

  getNeededAugs = (/** @type {string} */ faction) =>
    this.factionAugmentations[faction].filter((aug) => this.isUnowned(aug));
}

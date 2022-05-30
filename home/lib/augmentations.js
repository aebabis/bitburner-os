import { FACTIONS } from './bin/self/aug/factions';
import { getStaticData  } from './lib/data-store';
import { by } from './lib/util';

const NEUROFLUX = 'NeuroFlux Governor';
const MONEY_PER_REP = 4000; // This will vary at some point

export class AugmentationInfo {
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
            .filter(aug=>this.isUnowned(aug))
            .sort(by(aug=>this.weightedCost(aug)));

        const augmentationFactions = {};
        for (const faction of FACTIONS)
            for (const augmentation of factionAugmentations[faction])
                if (augmentationFactions[augmentation] == null)
                    augmentationFactions[augmentation] = [faction];
                else
                    augmentationFactions[augmentation].push(faction);

        this.augmentationFactions = augmentationFactions;
    }

    isUnowned = aug => !this.ownedAugmentations.includes(aug) && aug !== NEUROFLUX;

    weightedCost = aug=>Math.max(
        this.augmentationPrices[aug]/MONEY_PER_REP,
        this.augmentationRepReqs[aug]);

    getPurchaseOrder(augs, limit=Infinity) {
      const order = new Set([]);
      augs.sort(by(aug=>-this.augmentationPrices[aug]));
      for (const aug of augs) {
        const prereqs = this.augmentationPrereqs[aug]
          .filter(aug=>this.isUnowned(aug))
          .reverse();
        for (const prereq of prereqs)
          order.add(prereq);
        order.add(aug);
      }
      return [...order].splice(0, limit);
    }

    getOrderCost(augs) {
        let mult = 1;
        let cost = 0;
        for (const aug of augs) {
          cost += this.augmentationPrices[aug] * mult;
          mult *= 1.9;
        }
        return cost;
    }

    getNeededAugs = faction => this.factionAugmentations[faction]
      .filter(aug => this.isUnowned(aug));
}


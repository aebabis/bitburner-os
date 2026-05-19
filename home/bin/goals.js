import {
  getStaticData,
  putGoalsData,
  getPlayerData,
} from "../lib/data-store";
import { table } from "../lib/table";
import { scoreAug, augEffectiveCost, getMoneyPerRep, DEFAULT_AUG_WEIGHTS } from "../lib/aug-select";

const NEUROFLUX = "NeuroFlux Governor";

/** @param {NS} ns @param {string} faction */
const getAugsForFaction = (ns, faction) => {
  const {
    factionAugmentations = {},
    ownedAugmentations = [],
    augmentationPrices = {},
    augmentationRepReqs = {},
    bitNodeMultipliers = /** @type {any} */ ({}),
  } = getStaticData(ns);
  const { purchasedAugmentations = [] } = getPlayerData(ns);
  const alreadyHave = new Set([...ownedAugmentations, ...purchasedAugmentations]);
  const moneyPerRep = getMoneyPerRep(bitNodeMultipliers?.FactionWorkRepGain);
  const weightedCost = (/** @type {string} */ aug) =>
    augEffectiveCost(augmentationPrices[aug] || 0, augmentationRepReqs[aug] || 0, moneyPerRep);
  const remaining = (factionAugmentations[faction] || [])
    .filter((/** @type {string} */ aug) => !alreadyHave.has(aug) && aug !== NEUROFLUX)
    .sort((/** @type {string} */ a, /** @type {string} */ b) => weightedCost(a) - weightedCost(b));
  const limit = 10 - purchasedAugmentations.length;
  return remaining.slice(0, Math.max(0, limit));
};

/** @param {NS} ns */
export async function main(ns) {
  const [command, ...rest] = ns.args;

  if (command === undefined) {
    // TODO: Show help?
    return;
  }

  switch (command) {
    case "faction": {
      const faction = /** @type {string} */ (rest[0]);
      if (!faction) {
        ns.tprint("ERROR: Usage: goals faction <name>");
        return;
      }
      const targetAugmentations = getAugsForFaction(ns, faction);
      putGoalsData(ns, { manualOverride: targetAugmentations });
      ns.tprint(`Target faction set to ${faction} (${targetAugmentations.length} augmentations queued)`);
      break;
    }
    case "reset":
      putGoalsData(ns, { manualOverride: null });
      ns.tprint("Goals reset to automatic");
      break;
    case 'aug-table': {
      const [sortKey = 'utility'] = rest;
      const {
        augmentations = /** @type {string[]} */ ([]),
        augmentationStats = /** @type {Record<string, Multipliers>} */ ({}),
        augmentationPrices = /** @type {Record<string, number>} */ ({}),
        augmentationRepReqs = /** @type {Record<string, number>} */ ({}),
        factionAugmentations = /** @type {Record<string, string[]>} */ ({}),
        ownedAugmentations = /** @type {string[]} */ ([]),
      } = getStaticData(ns);

      if (Object.keys(augmentationStats).length === 0) {
        ns.tprint("ERROR aug-table: augmentationStats not loaded — run the augment suite first");
        break;
      }
      if (Object.keys(augmentationPrices).length === 0) {
        ns.tprint("ERROR aug-table: augmentationPrices not loaded — run the augment suite first");
        break;
      }

      const { bitNodeMultipliers = {} } = getStaticData(ns);
      const moneyPerRep = getMoneyPerRep(bitNodeMultipliers?.FactionWorkRepGain);

      const augFactions = /** @type {Record<string, string[]>} */ ({});
      for (const [faction, augs] of Object.entries(factionAugmentations))
        for (const aug of augs)
          (augFactions[aug] ??= []).push(faction);

      const scored = augmentations
        .filter(aug => aug === NEUROFLUX || !ownedAugmentations.includes(aug))
        .map(aug => {
          const stats = augmentationStats[aug];
          const price = augmentationPrices[aug] ?? 0;
          const repReq = augmentationRepReqs[aug] ?? 0;
          const value = stats != null ? scoreAug(stats, DEFAULT_AUG_WEIGHTS) : 0;
          const cost = augEffectiveCost(price, repReq, moneyPerRep);
          const utility = cost > 0 ? value / cost : 0;
          return { aug, value, cost, utility, factions: augFactions[aug] ?? [] };
        })
        .sort((a, b) =>
          sortKey === 'value' ? b.value - a.value :
          sortKey === 'cost'  ? b.cost  - a.cost  :
          b.utility - a.utility
        );

      const fmt = /** @param {string | number} x */ (x) =>
        ns.format.number(/** @type {number} */ (x), 3);
      ns.tprint('\n' + table(ns, [
        'Augmentation',
        { name: 'Value',      align: 'right', process: fmt },
        { name: 'Eff. Cost',  align: 'right', process: fmt },
        { name: 'Utility×1M', align: 'right', process: /** @param {string | number} x */ (x) =>
          fmt(/** @type {number} */ (x) * 1e6) },
        'Factions',
      ], scored.map(({ aug, value, cost, utility, factions }) =>
        [aug, value, cost, utility, factions.join(', ')]
      )));
      break;
    }
    default:
      ns.tprint("Commands: disable | enable | faction <name> | reset | aug-table [utility|value|cost]");
  }
}

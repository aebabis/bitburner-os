import {
  getStaticData,
  putGoalsData,
  getPlayerData,
  getMoneyData,
} from "../lib/data-store";
import { table } from "../lib/table";
import { augValueFromStats } from "../lib/aug-select";

const NEUROFLUX = "NeuroFlux Governor";

/** @param {NS} ns @param {string} faction */
const getAugsForFaction = (ns, faction) => {
  const {
    factionAugmentations = {},
    ownedAugmentations = [],
    augmentationPrices = {},
  } = getStaticData(ns);
  const { purchasedAugmentations = [] } = getPlayerData(ns);
  const alreadyHave = new Set([...ownedAugmentations, ...purchasedAugmentations]);
  const remaining = (factionAugmentations[faction] || [])
    .filter((/** @type {string} */ aug) => !alreadyHave.has(aug) && aug !== NEUROFLUX)
    .sort((/** @type {string} */ a, /** @type {string} */ b) =>
      (augmentationPrices[b] ?? 0) - (augmentationPrices[a] ?? 0));
  const limit = 10 - purchasedAugmentations.length;
  return remaining.slice(0, Math.max(0, limit));
};

/** @param {NS} ns */
const getAugTableData = (ns) => {
  const {
    augmentations = /** @type {string[]} */ ([]),
    augmentationStats = /** @type {Record<string, Multipliers>} */ ({}),
    augmentationPrices = /** @type {Record<string, number>} */ ({}),
    augmentationRepReqs = /** @type {Record<string, number>} */ ({}),
    ownedAugmentations = /** @type {string[]} */ ([]),
    resetInfo = /** @type {any} */ ({}),
  } = getStaticData(ns);
  const { purchasedAugmentations = /** @type {string[]} */ ([]) } = getPlayerData(ns);
  const alreadyHave = new Set([...ownedAugmentations, ...purchasedAugmentations]);
  const installedNFCount = resetInfo?.ownedAugs?.get(NEUROFLUX) ?? 0;
  return { augmentations, augmentationStats, augmentationPrices, augmentationRepReqs, alreadyHave, installedNFCount };
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
      const { augmentations, augmentationStats, augmentationPrices, augmentationRepReqs, alreadyHave, installedNFCount } =
        getAugTableData(ns);

      if (Object.keys(augmentationStats).length === 0) {
        ns.tprint("ERROR aug-table: augmentationStats not loaded — run the augment suite first");
        break;
      }
      if (Object.keys(augmentationPrices).length === 0) {
        ns.tprint("ERROR aug-table: augmentationPrices not loaded — run the augment suite first");
        break;
      }

      const rows = augmentations
        .filter(aug => aug === NEUROFLUX || !alreadyHave.has(aug))
        .map(aug => {
          const nfMult = aug === NEUROFLUX ? 1.14 ** installedNFCount : 1;
          const value = augValueFromStats(aug, augmentationStats);
          const price = (augmentationPrices[aug] ?? 0) * nfMult;
          const repReq = (augmentationRepReqs[aug] ?? 0) * nfMult;
          return { aug, value, price, repReq };
        })
        .sort((a, b) => b.value - a.value);

      const fmt = /** @param {string | number} x */ (x) =>
        ns.format.number(/** @type {number} */ (x), 3);
      ns.tprint('\n' + table(ns, [
        'Augmentation',
        { name: 'Value',   align: 'right', process: fmt },
        { name: 'Price',   align: 'right', process: fmt },
        { name: 'Rep Req', align: 'right', process: fmt },
      ], rows.map(({ aug, value, price, repReq }) => [aug, value, price, repReq])));
      break;
    }
    case 'aug-live': {
      ns.disableLog('ALL');
      ns.ui.openTail();
      while (true) {
        const { augmentations, augmentationStats, augmentationPrices, augmentationRepReqs, alreadyHave, installedNFCount } =
          getAugTableData(ns);
        const {
          referenceIncome = 0,
        } = getMoneyData(ns);
        const {
          factionRep = /** @type {Record<string, number>} */ ({}),
          activeRepRate = /** @type {Record<string, number>} */ ({}),
        } = getPlayerData(ns);

        const { factionAugmentations = /** @type {Record<string, string[]>} */ ({}) } = getStaticData(ns);
        const augFactions = /** @type {Record<string, string[]>} */ ({});
        for (const [faction, augs] of Object.entries(factionAugmentations))
          for (const aug of augs)
            (augFactions[aug] ??= []).push(faction);

        const rows = augmentations
          .filter(aug => aug === NEUROFLUX || !alreadyHave.has(aug))
          .map(aug => {
            const nfMult = aug === NEUROFLUX ? 1.14 ** installedNFCount : 1;
            const value = augValueFromStats(aug, augmentationStats);
            const price = (augmentationPrices[aug] ?? 0) * nfMult;
            const repReq = (augmentationRepReqs[aug] ?? 0) * nfMult;
            const factions = augFactions[aug] ?? [];
            const bestRepRate = Math.max(0, ...Object.values(activeRepRate));
            const bestCurrentRep = Math.max(0, ...factions.map(f => factionRep[f] ?? 1));
            const remainingRep = Math.max(0, repReq - bestCurrentRep);
            const timeForMoney = referenceIncome > 0 ? price / referenceIncome : Infinity;
            const timeForRep = bestRepRate > 0 ? remainingRep / bestRepRate : (remainingRep > 0 ? Infinity : 0);
            const time = Math.max(timeForMoney, timeForRep);
            const utility = value > 0 && isFinite(time) && time > 0 ? value / time : 0;
            return { aug, value, utility };
          })
          .sort((a, b) => b.utility - a.utility);

        const fmt = /** @param {string | number} x */ (x) =>
          ns.format.number(/** @type {number} */ (x), 3);
        ns.clearLog();
        ns.print(table(ns, [
          'Augmentation',
          { name: 'Value',      align: 'right', process: fmt },
          { name: 'Utility×1M', align: 'right', process: /** @param {string | number} x */ (x) =>
            fmt(/** @type {number} */ (x) * 1e6) },
        ], rows.map(({ aug, value, utility }) => [aug, value, utility])));

        await ns.sleep(2000);
      }
    }
    default:
      ns.tprint("Commands: faction <name> | reset | aug-table | aug-live");
  }
}

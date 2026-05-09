import {
  getStaticData,
  putStaticData,
  getGoalsData,
  putGoalsData,
  getPlayerData,
} from "../lib/data-store";

const NEUROFLUX = "NeuroFlux Governor";

/** @param {NS} ns @param {string} faction */
const getAugsForFaction = (ns, faction) => {
  const {
    factionAugmentations = {},
    ownedAugmentations = [],
    augmentationPrices = {},
    augmentationRepReqs = {},
  } = getStaticData(ns);
  const { purchasedAugmentations = [] } = getPlayerData(ns);
  const MONEY_PER_REP = 4000;
  const alreadyHave = new Set([...ownedAugmentations, ...purchasedAugmentations]);
  const weightedCost = (/** @type {string} */ aug) =>
    Math.max((augmentationPrices[aug] || 0) / MONEY_PER_REP, augmentationRepReqs[aug] || 0);
  const remaining = (factionAugmentations[faction] || [])
    .filter((/** @type {string} */ aug) => !alreadyHave.has(aug) && aug !== NEUROFLUX)
    .sort((/** @type {string} */ a, /** @type {string} */ b) => weightedCost(a) - weightedCost(b));
  const limit = 10 - purchasedAugmentations.length;
  return remaining.slice(0, Math.max(0, limit));
};

/** @param {NS} ns */
const runService = async (ns) => {
  ns.disableLog("ALL");

  const existing = getGoalsData(ns);
  if (existing.targetFaction === undefined) {
    const { targetFaction, targetAugmentations } = getStaticData(ns);
    putGoalsData(ns, { enabled: true, targetFaction, targetAugmentations, manualOverride: false });
  }

  while (true) {
    const { manualOverride, targetFaction, targetAugmentations } = getGoalsData(ns);
    if (!manualOverride) {
      const staticData = getStaticData(ns);
      putGoalsData(ns, {
        targetFaction: staticData.targetFaction,
        targetAugmentations: staticData.targetAugmentations,
      });
    } else {
      putStaticData(ns, { targetFaction, targetAugmentations });
    }
    await ns.sleep(5000);
  }
};

/** @param {NS} ns */
export async function main(ns) {
  const [command, ...rest] = ns.args;

  if (command === undefined) {
    await runService(ns);
    return;
  }

  switch (command) {
    case "disable":
      putGoalsData(ns, { enabled: false });
      ns.tprint("Goals disabled");
      break;
    case "enable":
      putGoalsData(ns, { enabled: true });
      ns.tprint("Goals enabled");
      break;
    case "faction": {
      const faction = /** @type {string} */ (rest[0]);
      if (!faction) {
        ns.tprint("ERROR: Usage: goals faction <name>");
        return;
      }
      const targetAugmentations = getAugsForFaction(ns, faction);
      putGoalsData(ns, { targetFaction: faction, targetAugmentations, manualOverride: true });
      putStaticData(ns, { targetFaction: faction, targetAugmentations });
      ns.tprint(`Target faction set to ${faction} (${targetAugmentations.length} augmentations queued)`);
      break;
    }
    case "reset":
      putGoalsData(ns, { manualOverride: false });
      ns.tprint("Goals reset to automatic");
      break;
    default:
      ns.tprint("Commands: disable | enable | faction <name> | reset");
  }
}

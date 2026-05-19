import { putPlayerData } from "../../../lib/data-store";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.tprint("Loading Purchased Augmentations");

  const purchasedAugmentations = ns.singularity.getOwnedAugmentations(true);
  putPlayerData(ns, { purchasedAugmentations });
}

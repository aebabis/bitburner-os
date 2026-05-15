import { putStaticData } from "../../../lib/data-store";
import { FACTIONS } from "./factions";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  const factionFavorGain = /** @type {Record<string, number>} */ ({});
  for (const faction of FACTIONS)
    factionFavorGain[faction] = ns.singularity.getFactionFavorGain(faction);

  const favorToDonate = ns.singularity.getFavorToDonate();

  putStaticData(ns, { factionFavorGain, favorToDonate });
}

import { getStaticData, getGangData } from "../../../lib/data-store";
import { CITY_FACTIONS } from "./factions";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  const { cityFaction, targetFaction } = getStaticData(ns);
  const gang = getGangData(ns)?.gangInfo?.faction;
  const invites = ns.singularity.checkFactionInvitations();
  for (const faction of invites) {
    if (
      faction === cityFaction ||
      faction === targetFaction ||
      !CITY_FACTIONS.includes(faction) ||
      gang != null
    )
      ns.singularity.joinFaction(faction);
  }
}

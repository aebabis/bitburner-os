import { shouldWorkHaveFocus } from "../../lib/query-service";
import { getPlayerData, putPlayerData } from "../../lib/data-store";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  const faction = /** @type {string} */ (ns.args[0]);
  const focus = shouldWorkHaveFocus(ns);
  if (
    ns.singularity.workForFaction(faction, 'hacking', focus) ||
    ns.singularity.workForFaction(faction, 'field', focus) ||
    ns.singularity.workForFaction(faction, 'security', focus)
  ) {
    putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
    const DELAY = 10;
    await ns.sleep(DELAY * 1000);

    const { factionRep = {}, activeRepRate = {}, currentWork } = getPlayerData(ns);
    factionRep[faction] = ns.singularity.getFactionRep(faction);
    activeRepRate[faction] = currentWork.workRepGained / DELAY;
    putPlayerData(ns, {
      factionRep,
      activeRepRate,
      currentWork: ns.singularity.getCurrentWork(),
    });
  }
}

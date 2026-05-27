import { shouldWorkHaveFocus } from '../../lib/query-service';
import { getPlayerData, putPlayerData } from '../../lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog('ALL');
  const faction = /** @type {string} */ (ns.args[0]);
  const duration = ns.args[1] ?? 10;
  const focus = shouldWorkHaveFocus(ns);
  if (
    ns.singularity.workForFaction(faction, 'hacking', focus) ||
    ns.singularity.workForFaction(faction, 'field', focus) ||
    ns.singularity.workForFaction(faction, 'security', focus)
  ) {
    putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
    const start = new Date();
    const repBefore = ns.singularity.getFactionRep(faction);

    await ns.sleep(duration * 1000);

    const end = new Date();
    const repAfter = ns.singularity.getFactionRep(faction);

    const seconds = (+end - +start) / 1000;
    const repRate = (repAfter - repBefore) / seconds;

    const { factionRep = {}, activeRepRate = {} } = getPlayerData(ns);
    factionRep[faction] = ns.singularity.getFactionRep(faction);
    activeRepRate[faction] = repRate;
    putPlayerData(ns, {
      factionRep,
      activeRepRate,
      currentWork: ns.singularity.getCurrentWork(),
    });
  }
}

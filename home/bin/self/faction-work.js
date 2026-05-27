import { shouldWorkHaveFocus } from '../../lib/query-service';
import { putPlayerData } from '../../lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog('ALL');
  const faction = /** @type {string} */ (ns.args[0]);
  const focus = shouldWorkHaveFocus(ns);
  if (ns.singularity.getCurrentWork()?.factionName === faction) {
    return;
  }
  if (
    ns.singularity.workForFaction(faction, 'hacking', focus) ||
    ns.singularity.workForFaction(faction, 'field', focus) ||
    ns.singularity.workForFaction(faction, 'security', focus)
  ) {
    putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
  }
}

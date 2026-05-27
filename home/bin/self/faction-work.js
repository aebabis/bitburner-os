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
  }
}

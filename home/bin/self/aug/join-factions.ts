import { getGangData } from '../../../lib/data-store';
import { getGoals } from '../../../lib/goals/goals';
import { CITY_FACTIONS } from '../../../lib/factions';

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog('ALL');
  const factionTargets = getGoals(ns)
    .filter((goal) => goal.type === 'FACTION_JOIN')
    .map((goal) => goal.faction);
  const gang = getGangData(ns)?.gangInfo?.faction;
  const invites = ns.singularity.checkFactionInvitations();
  for (const faction of invites) {
    if (
      factionTargets.includes(faction) ||
      !CITY_FACTIONS.includes(faction) ||
      gang != null
    )
      ns.singularity.joinFaction(faction);
  }
}

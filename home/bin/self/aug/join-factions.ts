import { getGangData } from '../../../lib/data-store';
import { getGoals } from '../../../lib/goals/goals';
import { CITY_FACTIONS } from '../../../lib/factions';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  const factionTargets = getGoals(ns)
    .prerequisites('FACTION_JOIN')
    .map((g) => g.faction);
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

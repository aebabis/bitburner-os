import { getGoals } from '../../../lib/goals/goals';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  const factionTargets = getGoals(ns)
    .prerequisites('FACTION_JOIN')
    .map((g) => g.faction);
  const invites = ns.singularity.checkFactionInvitations();
  for (const faction of invites) {
    if (
      factionTargets.includes(faction) ||
      !Object.values(ns.enums.CityName).includes(faction as CityName) ||
      ns.gang.inGang()
    )
      ns.singularity.joinFaction(faction);
  }
}

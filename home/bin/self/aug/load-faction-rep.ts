import { putPlayerData } from '../../../lib/data-store';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  const factionRep = {} as Record<FactionName, number>;
  const factions = Object.values(ns.enums.FactionName);
  for (const faction of factions) {
    factionRep[faction] = ns.singularity.getFactionRep(faction);
  }
  putPlayerData(ns, { factionRep });
}

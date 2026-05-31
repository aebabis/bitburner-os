import { putStaticData } from '../../../lib/data-store';
import { FACTIONS } from '../../../lib/factions';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.tprint('Loading Faction Requirements');

  const factionWorkTypes: Record<FactionName, FactionWorkType[]> = {};
  for (const faction of FACTIONS)
    factionWorkTypes[faction] = ns.singularity.getFactionWorkTypes(faction);

  putStaticData(ns, { factionWorkTypes });
}

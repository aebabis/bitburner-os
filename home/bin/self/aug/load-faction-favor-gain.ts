import { putStaticData } from '../../../lib/data-store';

export async function main(ns: NS) {
  ns.disableLog('ALL');

  const factionFavorGain = {} as Record<FactionName, number>;
  const factions = Object.values(ns.enums.FactionName) as FactionName[];
  for (const faction of factions)
    factionFavorGain[faction] = ns.singularity.getFactionFavorGain(faction);

  const favorToDonate = ns.getFavorToDonate();

  putStaticData(ns, { factionFavorGain, favorToDonate });
}

import { putStaticData } from '../../../lib/data-store';
import { FACTIONS } from '../../../lib/factions';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.tprint('Loading Faction Favor');

  const factionFavor = /** @type {Record<string, number>} */ {};

  for (const faction of FACTIONS)
    factionFavor[faction] = ns.singularity.getFactionFavor(faction);

  putStaticData(ns, { factionFavor });
}

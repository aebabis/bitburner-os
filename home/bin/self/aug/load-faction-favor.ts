import { tprint } from '../../../boot/util';
import { STR } from '../../../lib/colors';
import { putStaticData } from '../../../lib/data-store';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  tprint(ns)(STR + '  Loading Faction Favor');

  const factionFavor: Record<string, number> = {};

  for (const faction of Object.values(ns.enums.FactionName))
    factionFavor[faction] = ns.singularity.getFactionFavor(faction);

  putStaticData(ns, { factionFavor });
}

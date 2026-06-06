import { tprint } from '../../../boot/util';
import { STR } from '../../../lib/colors';
import { putStaticData } from '../../../lib/data-store';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  tprint(ns)(STR + '  Loading Faction Requirements');

  const factionWorkTypes = Object.fromEntries(
    Object.values(ns.enums.FactionName).map((faction) => [
      faction,
      ns.singularity.getFactionWorkTypes(faction),
    ]),
  ) as Record<FactionName, FactionWorkType[]>;

  putStaticData(ns, { factionWorkTypes });
}

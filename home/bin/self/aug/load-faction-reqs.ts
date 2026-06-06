import { tprint } from '../../../boot/util';
import { STR } from '../../../lib/colors';
import { putStaticData } from '../../../lib/data-store';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  tprint(ns)(STR + '  Loading Faction Requirements');

  const factionRequirements = Object.fromEntries(
    Object.values(ns.enums.FactionName).map((faction) => [
      faction,
      ns.singularity.getFactionInviteRequirements(faction),
    ]),
  ) as Record<FactionName, PlayerRequirement[]>;

  putStaticData(ns, { factionRequirements });
}

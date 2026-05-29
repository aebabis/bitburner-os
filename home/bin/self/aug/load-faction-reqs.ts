import { putStaticData } from '../../../lib/data-store';
import { FACTIONS } from '../../../lib/factions';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.tprint('Loading Faction Requirements');

  const factionRequirements = Object.fromEntries(
    FACTIONS.map((faction) => [
      faction,
      ns.singularity.getFactionInviteRequirements(faction),
    ]),
  );

  putStaticData(ns, { factionRequirements });
}

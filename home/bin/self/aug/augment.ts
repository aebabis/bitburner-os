import { tprint } from '../../../boot/util';
import { STR } from '../../../lib/colors';
import { putPlayerData } from '../../../lib/data-store';
import { getGoals } from '../../../lib/goals/goals';
import { inPlace } from '../../../lib/in-place';
import { nmap } from '../../../lib/nmap';
import { getPurchasedAugmentations } from './load-owned-augs';

const getRep = async (ns: NS) => {
  const factionRep = {} as Record<FactionName, number>;
  const factions = Object.values(ns.enums.FactionName);
  for (const faction of factions) {
    factionRep[faction] = await inPlace(ns).singularity['getFactionRep'](faction);
  }
  return factionRep;
};

const joinFactions = async (ns: NS) => {
  const factionTargets = getGoals(ns)
    .prerequisites('FACTION_JOIN')
    .map((g) => g.faction);
  const invites = await inPlace(ns).singularity['checkFactionInvitations']();
  for (const faction of invites) {
    if (
      factionTargets.includes(faction) ||
      !Object.values(ns.enums.CityName).includes(faction as CityName) ||
      ns.gang.inGang()
    )
      await inPlace(ns).singularity['joinFaction'](faction);
  }
};

export async function main(ns: NS) {
  ns.singularity.getOwnedAugmentations;

  ns.disableLog('ALL');

  while (true) {
    putPlayerData(ns, { factionRep: await getRep(ns) });
    putPlayerData(ns, { purchasedAugmentations: await getPurchasedAugmentations(ns) });
    await joinFactions(ns);

    const root = getGoals(ns);
    if (root.type === 'INSTALL' && root.deps.every((g) => g.isDone())) {
      tprint(ns)(STR.BOLD + 'INSTALLING');
      tprint(ns)(STR + '  Stopping all programs');
      for (const hostname of nmap(ns))
        for (const { pid } of ns.ps(hostname))
          if (pid !== ns.pid) {
            ns.ui.closeTail(pid);
            ns.kill(pid);
          }
      ns.exec('/bin/self/aug/purchase-augs.ts', 'home');
      return;
    }

    await ns.sleep(100);
  }
}

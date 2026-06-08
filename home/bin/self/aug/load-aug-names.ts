import { tprint } from '../../../boot/util';
import { STR } from '../../../lib/colors';
import { putStaticData } from '../../../lib/data-store';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  tprint(ns)(STR + '  Loading Augmentation Names');

  const factionAugmentations = {} as Record<FactionName, string[]>;
  const augSet = new Set<string>();

  const factions = Object.values(ns.enums.FactionName) as FactionName[];
  for (const faction of factions) {
    const list = ns.singularity.getAugmentationsFromFaction(faction);
    factionAugmentations[faction] = list;
    for (const name of list) augSet.add(name);
  }
  const augmentations = [...augSet];

  putStaticData(ns, { factionAugmentations, augmentations });
}

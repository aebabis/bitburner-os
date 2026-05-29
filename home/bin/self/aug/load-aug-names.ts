import { putStaticData } from '../../../lib/data-store';
import { FACTIONS } from '../../../lib/factions';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.tprint('Loading Augmentation Names');

  const factionAugmentations = /** @type {Record<string, string[]>} */ {};
  const augSet = new Set();

  for (const faction of FACTIONS) {
    const list = ns.singularity.getAugmentationsFromFaction(faction);
    factionAugmentations[faction] = list;
    for (const name of list) augSet.add(name);
  }
  const augmentations = [...augSet];

  putStaticData(ns, { factionAugmentations, augmentations });
}

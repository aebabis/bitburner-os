import { getStaticData, putStaticData } from '../lib/data-store';
import { defer } from './defer';
import { tprint } from './util';
import { STR } from '../lib/colors';

export async function main(ns: NS) {
  tprint(ns)(STR.BOLD + 'LOADING GRAFTING DATA');

  tprint(ns)(STR + '  Loading Graftable Augmentations');
  const graftableAugmentations = ns.grafting.getGraftableAugmentations();

  tprint(ns)(STR + '  Loading Graft Times and Prices');
  const augmentationGraftPrices: Record<string, number> = {};
  const augmentationGraftTimes: Record<string, number> = {};
  for (const aug of graftableAugmentations) {
    augmentationGraftPrices[aug] = ns.grafting.getAugmentationGraftPrice(aug);
    augmentationGraftTimes[aug] = ns.grafting.getAugmentationGraftTime(aug);
  }

  tprint(ns)(STR + '  Patching in violet');
  const { augmentations } = getStaticData(ns);
  const NR = 'Neuroreceptor Management Implant';
  const { stats } = augmentations.find((aug) => aug.name === NR)!;
  augmentations.push({
    name: 'violet Congruity Implant',
    price: Infinity,
    repReq: Infinity,
    prereqs: [],
    stats,
    factions: [],
  });

  putStaticData(ns, {
    augmentations,
    graftableAugmentations,
    augmentationGraftPrices,
    augmentationGraftTimes,
  });

  // Go to next step in the boot sequence
  await defer(ns)(...ns.args);
}

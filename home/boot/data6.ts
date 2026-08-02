import { getStaticData, putStaticData } from '../lib/data-store';
import { defer } from './defer';
import { tprint } from './util';
import { STR } from '../lib/colors';
import { NRMI, vIOLET } from '../etc/augmentations';

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

  const { singularityData } = getStaticData(ns);
  if (singularityData == null) {
    tprint(ns)(STR + '  Skipping violet patch (no augmentation data)');
  } else {
    tprint(ns)(STR + '  Patching in violet');
    const { stats } = singularityData.augmentations.find((aug) => aug.name === NRMI)!;
    singularityData.augmentations.push({
      name: vIOLET,
      price: Infinity,
      repReq: Infinity,
      prereqs: [],
      stats,
      factions: [],
    });
    putStaticData(ns, { singularityData });
  }

  putStaticData(ns, {
    graftingData: {
      graftableAugmentations,
      augmentationGraftPrices,
      augmentationGraftTimes,
    },
  });

  // Go to next step in the boot sequence
  await defer(ns)(...ns.args);
}

import { getStaticData, putStaticData } from '../lib/data-store';
import { defer } from './defer';
import { tprint } from './util';
import { STR } from '../lib/colors';

export async function main(ns: NS) {
  const { currentNode, ownedSF } = getStaticData(ns).resetInfo;
  tprint(ns)(STR.BOLD + 'ADDING MULTIPLIERS TO CACHE');

  let bitNodeMultipliers = null;
  if (currentNode === 5 || ownedSF.has(5)) {
    tprint(ns)(STR + '  Adding bit node multipliers to static data cache');
    bitNodeMultipliers = ns.getBitNodeMultipliers();
  }

  putStaticData(ns, {
    bitNodeMultipliers,
    hacknetMultipliers: ns.getHacknetMultipliers(),
  });

  // Go to next step in the boot sequence
  await defer(ns)(...ns.args);
}

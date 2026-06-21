import { putPlayerData } from '../lib/data-store';
import { defer } from './defer';
import { tprint } from './util';
import { STR } from '../lib/colors';

export async function main(ns: NS) {
  tprint(ns)(STR.BOLD + 'LOADING HOME RAM UPGRADE COST');

  putPlayerData(ns, {
    homeRamUpgradeCost: ns.singularity.getUpgradeHomeRamCost(),
  });

  // Go to next step in the boot sequence
  await defer(ns)(...ns.args);
}

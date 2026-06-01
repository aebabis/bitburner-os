import { putStaticData } from '../lib/data-store';
import { defer } from './defer';
import { tprint } from './util';
import { nmap, saveHostnames } from '../lib/nmap';
import { STR } from '../lib/colors';
import { AUG_LOG_FILE } from '../etc/config';

export async function main(ns: NS) {
  tprint(ns)(STR.BOLD + 'GENERATING STATIC DATA');

  tprint(ns)(STR + '  Precalculating static server costs');
  const purchasedServerMaxRam = ns.cloud.getRamLimit();
  const purchasedServerCosts = /** @type {Record<number, number>} */ {};
  for (let ram = purchasedServerMaxRam; ram >= 2; ram /= 2)
    purchasedServerCosts[ram] = ns.cloud.getServerCost(ram);

  tprint(ns)(STR + '  Storing script RAM costs');
  const scriptRam = /** @type {Record<string, number>} */ {};
  const scripts = ns.ls('home').filter((file) => file.endsWith('.ts'));
  for (const script of scripts) scriptRam[script] = ns.getScriptRam(script);

  tprint(ns)(STR + '  Caching network map');
  saveHostnames(ns);

  const resetInfo = ns.getResetInfo();
  if (resetInfo.lastAugReset === resetInfo.lastNodeReset)
    ns.rm(AUG_LOG_FILE, 'home');

  const serverBackdoorRequirements = nmap(ns).map((hostname) => ({
    hostname,
    requiredHackingLevel: ns.getServerRequiredHackingLevel(hostname),
    numPortsRequired: ns.getServerNumPortsRequired(hostname),
  }));

  putStaticData(ns, {
    resetInfo,
    installedAugmentations: [...resetInfo.ownedAugs.keys()],
    scriptRam,
    serverBackdoorRequirements,
    purchasedServerLimit: ns.cloud.getServerLimit(),
    purchasedServerMaxRam,
    purchasedServerCosts,
  });

  // Go to next step in the boot sequence
  await defer(ns)(...ns.args);
}

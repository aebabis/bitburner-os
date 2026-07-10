import { putStaticData } from '../lib/data-store';
import { defer } from './defer';
import { tprint } from './util';
import { nmap, saveHostnames } from '../lib/nmap';
import { STR } from '../lib/colors';
import { AUG_LOG_FILE } from '../etc/config';

const getStartingServerCost = (ns: NS) => {
  if (!ns.fileExists('Formulas.exe', 'home')) {
    return 69e9;
  }
  const mults = ns.getHacknetMultipliers();
  const { hacknetServers } = ns.formulas;
  return (
    hacknetServers.hacknetServerCost(1, mults.purchaseCost) +
    hacknetServers.levelUpgradeCost(1, 99, mults.levelCost) +
    hacknetServers.coreUpgradeCost(1, 9, mults.coreCost) +
    hacknetServers.cacheUpgradeCost(1, 4)
  );
};

export async function main(ns: NS) {
  tprint(ns)(STR.BOLD + 'GENERATING STATIC DATA');

  const resetInfo = ns.getResetInfo();
  const isFirstInstallCycle = resetInfo.lastAugReset === resetInfo.lastNodeReset;

  tprint(ns)(STR + '  Precalculating static server costs');
  const purchasedServerMaxRam = ns.cloud.getRamLimit();
  const purchasedServerCosts: Record<number, number> = {};
  for (let ram = purchasedServerMaxRam; ram >= 2; ram /= 2)
    purchasedServerCosts[ram] = ns.cloud.getServerCost(ram);

  let startingServerValue = 0;
  const getsFreeHacknetServers = resetInfo.currentNode === 9 || resetInfo.ownedSF.get(9) === 3;
  if (getsFreeHacknetServers && isFirstInstallCycle) {
    tprint(ns)(STR + '  Calculating value of free hacknet server');
    startingServerValue = getStartingServerCost(ns);
  }

  tprint(ns)(STR + '  Storing script RAM costs');
  const scriptRam: Record<string, number> = {};
  const scripts = ns.ls('home').filter((file) => file.endsWith('.ts'));
  for (const script of scripts) scriptRam[script] = ns.getScriptRam(script);

  tprint(ns)(STR + '  Caching network map');
  saveHostnames(ns);

  if (isFirstInstallCycle) ns.rm(AUG_LOG_FILE, 'home');

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
    startingServerValue,
    favorToDonate: ns.getFavorToDonate(),
  });

  // Go to next step in the boot sequence
  await defer(ns)(...ns.args);
}

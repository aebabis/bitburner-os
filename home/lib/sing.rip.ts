import { ERROR } from './colors';
import { getMoneyData, getStaticData, putPlayerData } from './data-store';
import { Goal } from './goals/nodes';
import { inPlace, runInPlace } from './in-place';
import { $nmap } from './nmap.rip';

export const $win = async (ns: NS, port: number) => {
  const hostnames = await $nmap(ns, port)();
  return runInPlace(
    ns,
    port,
  )((hostnames: string[], ERROR: string) => {
    const selfActualize = '/bin/self/actualize.ts';
    const actualizeRam = ns['getScriptRam'](selfActualize, 'home');
    const possibleHosts = hostnames
      .filter((hostname) => ns['getScriptRam'](selfActualize, hostname))
      .map((hostname) => ({ hostname, ram: ns['getServerMaxRam'](hostname) }))
      .filter(({ ram }) => ram >= actualizeRam);
    if (possibleHosts.length === 0) {
      ns['tprint'](ERROR + 'Critical error: not enough RAM to win');
      return;
    }
    const { hostname } = possibleHosts.reduce((a, b) => (a.ram >= b.ram ? a : b));
    ns['killall'](hostname, true);
    if (hostname === ns['getHostname']()) {
      ns['spawn'](selfActualize, { spawnDelay: 0 });
      ns['tprint'](ERROR + 'Critical error: failed to spawn ' + selfActualize);
    } else {
      if (!ns['exec'](selfActualize, hostname)) {
        ns['tprint'](ERROR + 'Critical error: failed to exec ' + selfActualize);
      }
    }
  })(hostnames, ERROR.toString());
};

export const $install = async (ns: NS, port: number) => {
  const hostnames = await $nmap(ns, port)();
  return runInPlace(
    ns,
    port,
  )((hostnames: string[]) => {
    for (const hostname of hostnames) ns['killall'](hostname, true);
    ns['exec']('/bin/self/aug/purchase-augs.ts', 'home');
  })(hostnames);
};

const $joinFactions = (ns: NS, port: number) => async (targets: FactionName[]) => {
  const invites = await inPlace(ns).singularity['checkFactionInvitations']();
  return runInPlace(
    ns,
    port,
  )((targets: FactionName[], invites: FactionName[]) => {
    const cityFactions = Object.values(ns.enums.CityName);
    for (const faction of invites) {
      if (
        targets.includes(faction) ||
        !cityFactions.includes(faction as CityName) ||
        ns.gang.inGang()
      )
        ns.singularity['joinFaction'](faction);
    }
  })(targets, invites);
};

const $getFactionRep = (ns: NS, port: number) =>
  runInPlace(
    ns,
    port,
  )(() => {
    const factionRep = {} as Record<FactionName, number>;
    const factions = Object.values(ns.enums.FactionName);
    for (const faction of factions) {
      factionRep[faction] = ns.singularity['getFactionRep'](faction);
    }
    return factionRep;
  })();

export const $getQueuedAugmentations = (ns: NS, port = ns.pid) =>
  runInPlace(
    ns,
    port,
  )(() => {
    const installedAugmentations = ns.singularity['getOwnedAugmentations'](false);
    const ownedAugmentations = ns.singularity['getOwnedAugmentations'](true);
    const queuedAugmentations = ownedAugmentations.slice();
    for (const aug of installedAugmentations)
      queuedAugmentations.splice(queuedAugmentations.indexOf(aug), 1);
    return queuedAugmentations;
  })();

const TOR_PORT = 704 * 6047;
type TorPurchases = Partial<Record<ProgramName | 'Tor', boolean>>;

const $tor = async (ns: NS, port = ns.pid) => {
  const $ = inPlace(ns, port);
  const hostnames = await $nmap(ns, port)();
  const neededPortLevel = await runInPlace(
    ns,
    port,
  )((hostnames: string[]) => {
    const hackLevel = ns['getHackingLevel']();
    return Math.max(
      ...hostnames
        .filter((hostname) => hostname !== 'home')
        .filter((hostname) => ns['getServerRequiredHackingLevel'](hostname) <= hackLevel)
        .map(ns['getServerNumPortsRequired']),
    );
  })(hostnames);
  const portData = ns.readPort(TOR_PORT);
  const purchases = (portData === 'NULL PORT DATA' ? {} : portData) as TorPurchases;
  // Purchases given input if not already held. The game prevents double-purchase;
  // purchaseTor and purchaseProgram return true if the program is already owned.
  // Guarding only exists to prevent unnecessary async call.
  const $purchase = async (program: ProgramName | 'Tor') =>
    (purchases[program] ||=
      program === 'Tor'
        ? await $.singularity['purchaseTor']()
        : await $.singularity['purchaseProgram'](program));
  if (await $purchase('Tor')) {
    await $purchase('Formulas.exe');
    await $purchase('DarkscapeNavigator.exe');
    if (neededPortLevel >= 1) await $purchase('BruteSSH.exe');
    if (neededPortLevel >= 2) await $purchase('FTPCrack.exe');
    if (neededPortLevel >= 3) await $purchase('relaySMTP.exe');
    if (neededPortLevel >= 4) await $purchase('HTTPWorm.exe');
    if (neededPortLevel >= 5) await $purchase('SQLInject.exe');
  }
  ns.writePort(TOR_PORT, purchases);
};

const $backup = (ns: NS, port = ns.pid) =>
  runInPlace(
    ns,
    port,
  )(() => {
    if (ns.singularity['exportGameBonus']()) ns.singularity['exportGame']();
  })();

export const $checkInstall =
  (ns: NS, port = ns.pid) =>
  async (goalTree: Goal) => {
    const currentWork = ns.singularity.getCurrentWork();
    const bbAction = ns.bladeburner.inBladeburner() ? ns.bladeburner.getCurrentAction() : null;
    if (currentWork?.type === 'GRAFTING') return;
    if (bbAction?.type === ns.enums.BladeburnerActionType.BlackOp) return;
    if (goalTree.type === 'INSTALL' && goalTree.deps.every((g) => g.isDone())) {
      // Make sure stocks have been sold before proceeding
      if (
        goalTree
          .prerequisites('AUG_MONEY')
          .every(({ requirement }) => requirement < ns.getPlayer().money)
      ) {
        await $install(ns, port);
      }
    }
  };

let homeRamInfoCache = {
  bnTimestamp: 0,
  currentRam: 0,
  upgradeCost: 0,
};
export const $manageHomeRam =
  (ns: NS, port = ns.pid) =>
  async (goalTree: Goal, resetInfo: ResetInfo) => {
    const currentRam = ns.getServerMaxRam('home');
    if (
      homeRamInfoCache.bnTimestamp !== resetInfo.lastNodeReset ||
      homeRamInfoCache.currentRam !== currentRam
    ) {
      homeRamInfoCache = {
        bnTimestamp: resetInfo.lastNodeReset,
        currentRam,
        upgradeCost: await inPlace(ns, port).singularity['getUpgradeHomeRamCost'](),
      };
    }
    if (resetInfo.currentNode === 8) {
      if (currentRam < 256) {
        await inPlace(ns, port).singularity['upgradeHomeRam']();
      }
    } else {
      const money = ns.getPlayer().money;
      const neededMoney = [
        ...goalTree.prerequisites('MONEY'),
        ...goalTree.prerequisites('AUG_MONEY'),
      ].reduce((total, goal) => total + goal.requirement, 0);
      const { estimatedStockValue } = getMoneyData(ns);
      const allowedSpend = Math.max(10e9, (estimatedStockValue + money - neededMoney) / 10);
      if (
        homeRamInfoCache.upgradeCost <= allowedSpend &&
        ns.getPlayer().money >= homeRamInfoCache.upgradeCost
      ) {
        await inPlace(ns, port).singularity['upgradeHomeRam']();
      }
    }
  };

export const $sing =
  (ns: NS, port = ns.pid) =>
  async (goalTree: Goal) => {
    await $backup(ns, port);
    await $tor(ns, port);

    const factionTargets = goalTree.prerequisites('FACTION_JOIN').map((g) => g.faction!);
    await $joinFactions(ns, port)(factionTargets);
    await $manageHomeRam(ns, port)(goalTree, getStaticData(ns).resetInfo);

    const factionRep = await $getFactionRep(ns, port);
    const queuedAugmentations = await $getQueuedAugmentations(ns, port);

    const dynamicSingData = { factionRep, queuedAugmentations };
    putPlayerData(ns, dynamicSingData);
    return dynamicSingData;
  };

import { putPlayerData } from './data-store';
import { Goal } from './goals/nodes';
import { inPlace, runInPlace } from './in-place';
import { $nmap } from './nmap.rip';

export const $win = (ns: NS, port: number) =>
  runInPlace(
    ns,
    port,
  )(() => {
    ns['killall']('home', true);
    ns['exec']('/bin/self/actualize.ts', 'home');
  })();

const $install = async (ns: NS, port: number) => {
  const hostnames = await $nmap(ns, port)();
  return runInPlace(
    ns,
    port,
  )((hostnames: string[]) => {
    for (const hostname of hostnames) ns['killall'](hostname, true);
    ns['exec']('/bin/self/aug/purchase-augs.ts', 'home');
  })(hostnames);
};

export const $joinFactions = (ns: NS, port: number) => async (targets: FactionName[]) => {
  const invites = await inPlace(ns).singularity['checkFactionInvitations']();
  return runInPlace(
    ns,
    port,
  )((targets: FactionName[], invites: FactionName[]) => {
    const cityFactions = Object.values(ns.enums.CityName);
    for (const faction of invites) {
      if (
        targets.includes(faction) ||
        cityFactions.includes(faction as CityName) ||
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

export const $getPurchasedAugmentations = (ns: NS, port = ns.pid) =>
  runInPlace(
    ns,
    port,
  )(() => {
    const installedAugmentations = ns.singularity['getOwnedAugmentations'](false);
    const ownedAugmentations = ns.singularity['getOwnedAugmentations'](true);
    const purchasedAugmentations = ownedAugmentations.slice();
    for (const aug of installedAugmentations)
      purchasedAugmentations.splice(purchasedAugmentations.indexOf(aug), 1);
    return purchasedAugmentations;
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
  const $purchase = async (program: ProgramName) => {
    purchases[program] = await $.singularity['purchaseProgram'](program);
  };
  purchases['Tor'] = purchases['Tor'] || (await $.singularity['purchaseTor']());
  await $purchase('Formulas.exe');
  if (neededPortLevel >= 1 && !purchases['BruteSSH.exe']) await $purchase('BruteSSH.exe');
  if (neededPortLevel >= 2 && !purchases['FTPCrack.exe']) await $purchase('FTPCrack.exe');
  if (neededPortLevel >= 3 && !purchases['relaySMTP.exe']) await $purchase('relaySMTP.exe');
  if (neededPortLevel >= 4 && !purchases['HTTPWorm.exe']) await $purchase('HTTPWorm.exe');
  if (neededPortLevel >= 5 && !purchases['SQLInject.exe']) await $purchase('SQLInject.exe');
  ns.writePort(TOR_PORT, purchases);
};

export const $sing =
  (ns: NS, port = ns.pid) =>
  async (goalTree: Goal) => {
    if (goalTree.type === 'INSTALL' && goalTree.deps.every((g) => g.isDone())) {
      await $install(ns, port);
    }

    await $tor(ns, port);

    const factionTargets = goalTree.prerequisites('FACTION_JOIN').map((g) => g.faction!);
    await $joinFactions(ns, port)(factionTargets);

    const factionRep = await $getFactionRep(ns, port);
    const purchasedAugmentations = await $getPurchasedAugmentations(ns, port);

    const dynamicSingData = { factionRep, purchasedAugmentations };
    putPlayerData(ns, dynamicSingData);
    return dynamicSingData;
  };

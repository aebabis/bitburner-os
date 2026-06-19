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

export const $getFactionRep = (ns: NS, port: number) =>
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

export const $getPurchasedAugmentations = (ns: NS, port: number) =>
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

export const $sing = (ns: NS, port: number) => async (goalTree: Goal) => {
  if (goalTree.type === 'INSTALL' && goalTree.deps.every((g) => g.isDone())) {
    await $install(ns, port);
  }

  const factionTargets = goalTree.prerequisites('FACTION_JOIN').map((g) => g.faction!);
  await $joinFactions(ns, port)(factionTargets);

  const factionRep = await $getFactionRep(ns, port);
  const purchasedAugmentations = await $getPurchasedAugmentations(ns, port);

  const dynamicSingData = { factionRep, purchasedAugmentations };
  putPlayerData(ns, dynamicSingData);
  return dynamicSingData;
};

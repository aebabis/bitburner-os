import { getGoals } from '../../../lib/goals/goals';
import { formulas } from '../../../lib/formulas';
import { AUG_LOG_FILE } from '../../../etc/config';
import { inPlace } from '../../../lib/in-place';
import { tprint } from '../../../boot/util';
import { STR } from '../../../lib/colors';

const NEUROFLUX = 'NeuroFlux Governor';

export const getPurchasedAugmentations = async (ns: NS) => {
  const installedAugmentations = await inPlace(ns).singularity['getOwnedAugmentations'](false);
  const ownedAugmentations = await inPlace(ns).singularity['getOwnedAugmentations'](true);
  const purchasedAugmentations = ownedAugmentations.slice();
  for (const aug of installedAugmentations)
    purchasedAugmentations.splice(purchasedAugmentations.indexOf(aug), 1);
  return purchasedAugmentations;
};

export async function main(ns: NS) {
  ns.disableLog('ALL');
  tprint(ns)(STR.BOLD + 'INSTALLING');
  tprint(ns)(STR + '  Stopping all programs');

  // Reserve RAM
  ns.singularity.purchaseAugmentation;

  if (ns.getHostname() !== 'home') {
    throw new Error('purchase-augs must be run on home');
  }

  const { factions } = ns.getPlayer();

  const root = getGoals(ns);
  const actions = root.type === 'INSTALL' ? root.actions : [];

  const targetAugmentations = actions.flatMap((a) => (a.type === 'BUY_AUG' ? [a.name] : []));

  const LOGFILE = `/log/reset-${Date.now()}.txt`;

  const print = (...args: (string | boolean | number)[]) => {
    ns.tprint(...args);
    ns.write(LOGFILE, args.join(' ') + '\n', 'a');
  };

  const dateStr = new Date().toLocaleDateString();
  const timeStr = new Date().toLocaleTimeString();
  print(`${dateStr} ${timeStr}`);

  for (const goal of [root, ...root.prerequisites()]) {
    print(goal.desc.padEnd(40) + ' ' + goal.type.padEnd(15) + ' ' + goal.isDone());
  }

  const run = async (script: string, threads: number, ...args: ScriptArg[]) => {
    print(`${script} ${args.join(' ')}`);
    const pid = ns.run(script, threads, ...args);
    if (pid === 0) {
      print(' failed to run');
    } else {
      while (ns.isRunning(pid)) await ns.sleep(50);
    }
  };

  // Sell all stocks
  print('Dumping stocks');
  if (ns.stock.hasTixApiAccess()) {
    const symbols = await inPlace(ns).stock['getSymbols']();
    for (const sym of symbols) {
      await inPlace(ns).stock['sellStock'](sym, Infinity);
    }
    const { currentNode, ownedSF } = ns.getResetInfo();
    if (currentNode === 8 || (ownedSF.get(8) ?? 0) >= 2) {
      for (const sym of symbols) {
        await inPlace(ns).stock['sellShort'](sym, Infinity);
      }
    }
  }

  const buyRep = actions.find((a) => a.type === 'BUY_REP');
  if (buyRep?.type === 'BUY_REP') {
    print('Buying ' + ns.format.number(buyRep.amount) + ' rep');
    const donationRate = formulas(ns).reputation.donationForRep(1, ns.getPlayer());
    const cost = Math.ceil(buyRep.amount * donationRate);
    print('Cost:  $' + ns.format.number(cost));
    print('Avail: $' + ns.format.number(ns.getPlayer().money));
    await run('/bin/self/aug/donate-to-faction.ts', 1, buyRep.faction, cost);
    print('Rep:   ' + (await inPlace(ns).singularity['getFactionRep'](buyRep.faction)));
  }

  print(`Attempting to purchase ${targetAugmentations.length} augmentations`);

  const buyAug = async (augmentation: string) => {
    for (const faction of factions) {
      if (await inPlace(ns).singularity['purchaseAugmentation'](faction, augmentation)) {
        return true;
      }
    }
    return false;
  };

  for (const augmentation of targetAugmentations) {
    const bought = await buyAug(augmentation);
    print(`  Purchase ${augmentation}?: ${bought}`);
  }

  // Spend what's left on Neuroflux
  let nfCount = 0;
  while (await buyAug(NEUROFLUX)) nfCount++;
  print(`  bought ${nfCount} Neuroflux`);

  // Buy RAM if we can
  await run('/bin/self/buy-ram.ts', 1);

  // Try to start next aug with market access
  await run('/bin/broker/purchase.ts', 1, 'purchaseWseAccount');
  await run('/bin/broker/purchase.ts', 1, 'purchaseTixApi');
  await run('/bin/broker/purchase.ts', 1, 'purchase4SMarketDataTixApi');
  await run('/bin/broker/purchase.ts', 1, 'purchase4SMarketData');

  const favorToDonate = ns.getFavorToDonate();

  let donationFaction = null;
  let highestFavor = 0;
  for (const faction of ns.getPlayer().factions) {
    const favor = await inPlace(ns).singularity['getFactionFavor'](faction);
    if (favor > highestFavor && favor >= favorToDonate) {
      donationFaction = faction;
      highestFavor = favor;
    }
  }
  if (donationFaction != null) {
    print('Buying favor and NFG from highest favor faction: ' + donationFaction);
    const currentNfgRepBase = await inPlace(ns).singularity['getAugmentationRepReq'](NEUROFLUX);
    do {
      const purchasedAugs = await getPurchasedAugmentations(ns);
      print('Purchased augs: ' + purchasedAugs);
      const purchasedNfg = purchasedAugs.filter((name) => name === NEUROFLUX);
      const repOfNextNeuroflux = currentNfgRepBase * 1.14 ** purchasedNfg.length;
      print('Next Rep: ' + repOfNextNeuroflux);
      const donationRate = formulas(ns).reputation.donationForRep(1, ns.getPlayer());
      const currentRep = await inPlace(ns).singularity['getFactionRep'](donationFaction);
      const donationAmount = (repOfNextNeuroflux - currentRep) * donationRate;
      print('Donation: $' + donationAmount);
      if (currentRep < repOfNextNeuroflux) {
        await run('/bin/self/aug/donate-to-faction.ts', 1, donationFaction, donationAmount);
      }
    } while (await inPlace(ns).singularity['purchaseAugmentation'](donationFaction, NEUROFLUX));

    print('Buying gang items');
    const gangMembers = await inPlace(ns).gang['getMemberNames']();
    for (const equipment of ns.gang.getEquipmentNames().reverse()) {
      for (const member of gangMembers) {
        await inPlace(ns).gang['purchaseEquipment'](member, equipment);
      }
    }

    print('Done buying NFG. Donating remaining money: $' + ns.format.number(ns.getPlayer().money));
    await run('/bin/self/aug/donate-to-faction.ts', 1, donationFaction, ns.getPlayer().money);
    print('Money now: $' + ns.format.number(ns.getPlayer().money));
  }

  const purchasedAugs = await getPurchasedAugmentations(ns);
  print(purchasedAugs.join('\n'));

  ns.write('/log/last-reset.txt', ns.read(LOGFILE), 'w');
  ns.write(AUG_LOG_FILE, `${new Date().toLocaleDateString()}----------------------------\n`, 'a');
  ns.write(AUG_LOG_FILE, purchasedAugs.join('\n') + '\n', 'a');

  // if (ns.getHostname() !== 'home') {
  //   ns.scp([AUG_LOG_FILE, LOGFILE, '/log/last-reset.txt'], 'home');
  // }

  // Start all over
  await run('/bin/self/aug/reset.ts', 1);
}

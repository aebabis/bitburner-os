import { getGoals } from '../../../lib/goals/goals';
import { formulas } from '../../../lib/formulas';
import { AUG_LOG_FILE } from '../../../etc/config';
import { inPlace } from '../../../lib/in-place';
import { tprint } from '../../../boot/util';
import { ERROR, STR } from '../../../lib/colors';
import { $getQueuedAugmentations } from '../../../lib/sing.rip';
import { nmap } from '../../../lib/nmap';

const NEUROFLUX = 'NeuroFlux Governor';

export async function main(ns: NS) {
  // Reserve RAM
  ns.singularity.purchaseAugmentation;

  const $ = inPlace(ns, ns.pid);

  if (ns.getHostname() !== 'home') {
    throw new Error('purchase-augs must be run on home');
  }

  const { money, factions } = ns.getPlayer();
  const root = getGoals(ns);
  const actions = root.type === 'INSTALL' ? root.actions : [];

  if (money < root.prerequisites('AUG_MONEY')[0]?.requirement) {
    ns.tprint(ERROR + 'Premature call to purchase-augs');
    ns.exec('start.ts', 'home', 1);
    throw new Error('Premature call to purchase-augs');
  }

  ns.disableLog('ALL');
  tprint(ns)(STR.BOLD + 'INSTALLING');
  tprint(ns)(STR + '  Stopping all programs');
  for (const hostname of nmap(ns)) ns['killall'](hostname, true);

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

  // Sell all stocks
  print('Dumping stocks');
  if (ns.stock.hasTixApiAccess()) {
    const { currentNode, ownedSF } = ns.getResetInfo();
    const canSellShort = currentNode === 8 || (ownedSF.get(8) ?? 0) >= 2;
    const saleGain = $.stock['getSaleGain'];
    for (const sym of await $.stock['getSymbols']()) {
      const [long, , short] = await $.stock['getPosition'](sym);
      if (long > 0 && (await saleGain(sym, long, 'L')) > 0) {
        await $.stock['sellStock'](sym, long);
      }
      if (short > 0 && canSellShort && (await saleGain(sym, short, 'S')) > 0) {
        await $.stock['sellShort'](sym, short);
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
    await $.singularity['donateToFaction'](buyRep.faction, cost);
    print('Rep:   ' + (await $.singularity['getFactionRep'](buyRep.faction)));
  }

  print(`Attempting to purchase ${targetAugmentations.length} augmentations`);

  const buyAug = async (augmentation: string) => {
    for (const faction of factions) {
      if (await $.singularity['purchaseAugmentation'](faction, augmentation)) {
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
  while (await $.singularity['upgradeHomeRam']());

  // Try to start next aug with market access
  await $.stock['purchaseWseAccount']();
  await $.stock['purchaseTixApi']();
  await $.stock['purchase4SMarketDataTixApi']();
  await $.stock['purchase4SMarketData']();

  const favorToDonate = ns.getFavorToDonate();

  let donationFaction = null;
  let highestFavor = 0;
  for (const faction of ns.getPlayer().factions) {
    const favor = await $.singularity['getFactionFavor'](faction);
    if (favor > highestFavor && favor >= favorToDonate) {
      donationFaction = faction;
      highestFavor = favor;
    }
  }
  if (donationFaction != null) {
    print('Buying favor and NFG from highest favor faction: ' + donationFaction);
    const currentNfgRepBase = await $.singularity['getAugmentationRepReq'](NEUROFLUX);
    do {
      const queuedAugmentations = await $getQueuedAugmentations(ns);
      print('Purchased augs: ' + queuedAugmentations);
      const purchasedNfg = queuedAugmentations.filter((name) => name === NEUROFLUX);
      const repOfNextNeuroflux = currentNfgRepBase * 1.14 ** purchasedNfg.length;
      print('Next Rep: ' + repOfNextNeuroflux);
      const donationRate = formulas(ns).reputation.donationForRep(1, ns.getPlayer());
      const currentRep = await $.singularity['getFactionRep'](donationFaction);
      const donationAmount = (repOfNextNeuroflux - currentRep) * donationRate;
      print('Donation: $' + donationAmount);
      if (currentRep < repOfNextNeuroflux) {
        await $.singularity['donateToFaction'](donationFaction, donationAmount);
      }
    } while (await $.singularity['purchaseAugmentation'](donationFaction, NEUROFLUX));

    print('Done buying NFG. Donating remaining money: $' + ns.format.number(ns.getPlayer().money));
    await $.singularity['donateToFaction'](donationFaction, ns.getPlayer().money);
    print('Money now: $' + ns.format.number(ns.getPlayer().money));
  }

  // Buy free augmentations last
  print('Attempting to buy awakening and serenity');
  print(
    'Awakening: ',
    await $.singularity['purchaseAugmentation'](
      'Church of the Machine God',
      "Stanek's Gift - Awakening",
    ),
  );
  print(
    'Serenity: ',
    await $.singularity['purchaseAugmentation'](
      'Church of the Machine God',
      "Stanek's Gift - Serenity",
    ),
  );

  if (ns.gang.inGang()) {
    print('Buying gang items');
    const gangMembers = await $.gang['getMemberNames']();
    for (const equipment of ns.gang.getEquipmentNames().reverse()) {
      for (const member of gangMembers) {
        await $.gang['purchaseEquipment'](member, equipment);
      }
    }
  }

  const queuedAugmentations = await $getQueuedAugmentations(ns);
  print(queuedAugmentations.join('\n'));

  ns.write('/log/last-reset.txt', ns.read(LOGFILE), 'w');
  ns.write(AUG_LOG_FILE, `${new Date().toLocaleDateString()}----------------------------\n`, 'a');
  ns.write(AUG_LOG_FILE, queuedAugmentations.join('\n') + '\n', 'a');

  // Start all over
  await inPlace(ns).singularity['softReset']('start.ts');
}

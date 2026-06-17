import { putPlayerData, getStaticData } from '../../../lib/data-store';
import { getGoals } from '../../../lib/goals/goals';
import { getPurchasedAugmentations } from './load-owned-augs';
import { dump } from '../../../bin/broker/dump';
import { formulas } from '../../../lib/formulas';
import { AUG_LOG_FILE } from '../../../etc/config';

const NEUROFLUX = 'NeuroFlux Governor';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  if (ns.getHostname() !== 'home') {
    throw new Error('purchase-augs must be run on home');
  }

  const { factions } = ns.getPlayer();
  putPlayerData(ns, {
    purchasedAugmentations: getPurchasedAugmentations(ns),
  });

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
  if (ns.stock.hasTixApiAccess()) dump(ns);

  const buyRep = actions.find((a) => a.type === 'BUY_REP');
  if (buyRep?.type === 'BUY_REP') {
    print('Buying ' + ns.format.number(buyRep.amount) + ' rep');
    const donationRate = formulas(ns).reputation.donationForRep(1, ns.getPlayer());
    const cost = buyRep.amount * donationRate;
    print('Cost:  $' + ns.format.number(cost));
    print('Avail: $' + ns.format.number(ns.getPlayer().money));
    await run('/bin/self/aug/donate-to-faction.ts', 1, buyRep.faction, cost);
    print('Rep:   ' + ns.singularity.getFactionRep(buyRep.faction));
  }

  print(`Attempting to purchase ${targetAugmentations.length} augmentations`);

  for (const augmentation of targetAugmentations) {
    const bought = factions.some((faction) =>
      ns.singularity.purchaseAugmentation(faction, augmentation),
    );
    print(`  Purchase ${augmentation}?: ${bought}`);
  }

  // Spend what's left on Neuroflux
  let nfCount = 0;
  while (factions.some((faction) => ns.singularity.purchaseAugmentation(faction, NEUROFLUX)))
    nfCount++;
  print(`  bought ${nfCount} Neuroflux`);

  // Buy RAM if we can
  await run('/bin/self/buy-ram.ts', 1);

  // Try to start next aug with market access
  await run('/bin/broker/purchase.ts', 1, 'purchaseWseAccount');
  await run('/bin/broker/purchase.ts', 1, 'purchaseTixApi');
  await run('/bin/broker/purchase.ts', 1, 'purchase4SMarketDataTixApi');
  await run('/bin/broker/purchase.ts', 1, 'purchase4SMarketData');

  const { factionFavor, favorToDonate, augmentationRepReqs } = getStaticData(ns);
  const highestFavorFaction = ns
    .getPlayer()
    .factions.filter((faction) => faction !== 'Slum Snakes')
    .reduce((f1, f2) => (factionFavor[f1] > factionFavor[f2] ? f1 : f2));
  print('Buying favor and NFG from highest favor faction: ' + highestFavorFaction);
  if (factionFavor[highestFavorFaction] >= favorToDonate) {
    const currentNfgRepBase = augmentationRepReqs[NEUROFLUX];
    do {
      const purchasedAugs = getPurchasedAugmentations(ns);
      print('Purchased augs: ' + purchasedAugs);
      const purchasedNfg = purchasedAugs.filter((name) => name === NEUROFLUX);
      const repOfNextNeuroflux = currentNfgRepBase * 1.14 ** purchasedNfg.length;
      print('Next Rep: ' + repOfNextNeuroflux);
      const donationRate = formulas(ns).reputation.donationForRep(1, ns.getPlayer());
      const currentRep = ns.singularity.getFactionRep(highestFavorFaction);
      const donationAmount = (repOfNextNeuroflux - currentRep) * donationRate;
      print('Donation: $' + donationAmount);
      if (currentRep < repOfNextNeuroflux) {
        await run('/bin/self/aug/donate-to-faction.ts', 1, highestFavorFaction, donationAmount);
      }
    } while (ns.singularity.purchaseAugmentation(highestFavorFaction, NEUROFLUX));

    print('Done buying NFG. Donating remaining money: $' + ns.format.number(ns.getPlayer().money));
    await run('/bin/self/aug/donate-to-faction.ts', 1, highestFavorFaction, ns.getPlayer().money);
    print('Money now: $' + ns.format.number(ns.getPlayer().money));
  }

  print(getPurchasedAugmentations(ns).join('\n'));

  ns.write('/log/last-reset.txt', ns.read(LOGFILE), 'w');
  ns.write(AUG_LOG_FILE, `${new Date().toLocaleDateString()}----------------------------\n`, 'a');
  ns.write(AUG_LOG_FILE, getPurchasedAugmentations(ns).join('\n') + '\n', 'a');

  // if (ns.getHostname() !== 'home') {
  //   ns.scp([AUG_LOG_FILE, LOGFILE, '/log/last-reset.txt'], 'home');
  // }

  // Start all over
  await run('/bin/self/aug/reset.ts', 1);
}

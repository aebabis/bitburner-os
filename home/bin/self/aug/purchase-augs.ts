import { putPlayerData, getStaticData } from '../../../lib/data-store';
import { getGoals } from '../../../lib/goals/goals';
import { by } from '../../../lib/util';
import { getPurchasedAugmentations } from './load-owned-augs';
import { nmap } from '../../../lib/nmap';
import { dump } from '../../../bin/broker/dump';
import { formulas } from '../../../lib/formulas';

const NEUROFLUX = 'NeuroFlux Governor';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  const { factions } = ns.getPlayer();
  putPlayerData(ns, {
    purchasedAugmentations: getPurchasedAugmentations(ns),
  });

  const goals = getGoals(ns);
  const joinGoals = goals.filter((goal) => goal.type === 'FACTION_JOIN');
  const repGoals = goals.filter((goal) =>
    ['FACTION_REP', 'FACTION_FAVOR'].includes(goal.type),
  );
  const moneyGoals = goals.filter((goal) =>
    ['MONEY', 'AUG_MONEY'].includes(goal.type),
  );

  const targetAugmentations = goals
    .filter((goal) => goal.type === 'AUGMENTATION')
    .map((goal) => goal.desc);

  const inTargetFactions = joinGoals.every((goal) => goal.isDone());
  const hasEnoughMoney = moneyGoals.every((goal) => goal.isDone());
  const hasEnoughRep = repGoals.every((goal) => goal.isDone());

  if (inTargetFactions && hasEnoughMoney && hasEnoughRep) {
    const LOGFILE = `/log/reset-${Date.now()}.txt`;

    const print = (...args: (string | boolean | number)[]) => {
      ns.tprint(...args);
      ns.write(LOGFILE, args.join(' ') + '\n', 'a');
    };
    print(new Date().toLocaleDateString());

    for (const goal of goals) {
      print(
        goal.desc.padEnd(40) + ' ' + goal.type.padEnd(15) + ' ' + goal.isDone(),
      );
    }

    print('Stopping all programs');
    for (const hostname of nmap(ns))
      for (const { pid } of ns.ps(hostname))
        if (pid !== ns.pid) {
          ns.ui.closeTail(pid);
          ns.kill(pid);
        }

    const finisher = ['home', 'THREADPOOL-01']
      .filter((hostname) => ns.serverExists(hostname))
      .sort(
        by(
          (hostname) =>
            -(ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname)),
        ),
      )[0];
    print(
      `Using ${finisher} (${ns.getServerMaxRam(finisher)}) as Singularity server`,
    );

    const run = async (
      script: string,
      threads: number,
      ...args: ScriptArg[]
    ) => {
      print(`${script} ${args.join(' ')}`);
      const pid = ns.exec(script, finisher, threads, ...args);
      if (pid === 0) {
        print(' failed to run');
      } else {
        while (ns.isRunning(pid)) await ns.sleep(50);
      }
    };

    // Sell all stocks
    print('Dumping stocks');
    if (ns.stock.hasTixApiAccess()) dump(ns);

    const buyRepGoal = goals.find((goal) => goal.type === 'BUY_REP');
    if (buyRepGoal != null) {
      print('Buying ' + ns.format.number(buyRepGoal.requirement) + ' rep');
      const donationRate = formulas(ns).reputation.donationForRep(
        1,
        ns.getPlayer(),
      );
      const cost = buyRepGoal.requirement * donationRate;
      print('Cost:  $' + ns.format.number(cost));
      print('Avail: $' + ns.format.number(ns.getPlayer().money));
      await run(
        '/bin/self/aug/donate-to-faction.ts',
        1,
        buyRepGoal.faction,
        cost,
      );
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
    while (
      factions.some((faction) =>
        ns.singularity.purchaseAugmentation(faction, NEUROFLUX),
      )
    )
      nfCount++;
    print(`  bought ${nfCount} Neuroflux`);

    // Buy RAM if we can
    await run('/bin/self/buy-ram.ts', 1);

    // Try to start next aug with market access
    await run('/bin/broker/purchase.ts', 1, 'purchaseWseAccount');
    await run('/bin/broker/purchase.ts', 1, 'purchaseTixApi');
    await run('/bin/broker/purchase.ts', 1, 'purchase4SMarketDataTixApi');
    await run('/bin/broker/purchase.ts', 1, 'purchase4SMarketData');

    const { factionFavor, favorToDonate, augmentationRepReqs } =
      getStaticData(ns);
    const highestFavorFaction = ns
      .getPlayer()
      .factions.filter((faction) => faction !== 'Slum Snakes')
      .reduce((f1, f2) => (factionFavor[f1] > factionFavor[f2] ? f1 : f2));
    print(
      'Buying favor and NFG from highest favor faction: ' + highestFavorFaction,
    );
    if (factionFavor[highestFavorFaction] >= favorToDonate) {
      const currentNfgRepBase = augmentationRepReqs[NEUROFLUX];
      do {
        const purchasedAugs = getPurchasedAugmentations(ns);
        print('Purchased augs: ' + purchasedAugs);
        const purchasedNfg = purchasedAugs.filter((name) => name === NEUROFLUX);
        const repOfNextNeuroflux =
          currentNfgRepBase * 1.14 ** purchasedNfg.length;
        print('Next Rep: ' + repOfNextNeuroflux);
        const donationRate = formulas(ns).reputation.donationForRep(
          1,
          ns.getPlayer(),
        );
        const currentRep = ns.singularity.getFactionRep(highestFavorFaction);
        const donationAmount = (repOfNextNeuroflux - currentRep) * donationRate;
        print('Donation: $' + donationAmount);
        if (currentRep < repOfNextNeuroflux) {
          await run(
            '/bin/self/aug/donate-to-faction.ts',
            1,
            highestFavorFaction,
            donationAmount,
          );
        }
      } while (
        ns.singularity.purchaseAugmentation(highestFavorFaction, NEUROFLUX)
      );

      print(
        'Done buying NFG. Donating remaining money: $' +
          ns.format.number(ns.getPlayer().money),
      );
      await run(
        '/bin/self/aug/donate-to-faction.ts',
        1,
        highestFavorFaction,
        ns.getPlayer().money,
      );
      print('Money now: $' + ns.format.number(ns.getPlayer().money));
    }

    print(getPurchasedAugmentations(ns).join('\n'));

    ns.write('/log/last-reset.txt', ns.read(LOGFILE), 'w');

    // Start all over
    await run('/bin/self/aug/install.ts', 1);
  }
}

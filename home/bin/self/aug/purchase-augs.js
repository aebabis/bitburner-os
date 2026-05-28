import { putPlayerData, getStaticData } from '../../../lib/data-store';
import { getGoals } from '../../../lib/goals/goals';
import { by } from '../../../lib/util';
import { nmap } from '../../../lib/nmap';
import { dump } from '../../../bin/broker/dump';

const NEUROFLUX = 'NeuroFlux Governor';

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog('ALL');
  const { factions, money } = ns.getPlayer();
  const installedAugmentations = ns.singularity.getOwnedAugmentations(false);
  const ownedAugmentations = ns.singularity.getOwnedAugmentations(true);
  const purchasedAugmentations = ownedAugmentations.slice();
  for (const aug of installedAugmentations)
    purchasedAugmentations.splice(purchasedAugmentations.indexOf(aug), 1);

  putPlayerData(ns, { purchasedAugmentations });

  const goals = getGoals(ns);
  const factionJoinGoals = goals.filter((goal) => goal.type === 'FACTION_JOIN');
  const factionRepGoals = goals.filter((goal) => goal.type === 'FACTION_REP');
  const moneyGoals = goals.filter((goal) => goal.type === 'AUG_MONEY');

  const targetAugmentations = goals
    .filter((goal) => goal.type === 'AUGMENTATION')
    .map((goal) => goal.desc);

  const inTargetFactions = factionJoinGoals.every((goal) => goal.isDone());
  const hasEnoughMoney = moneyGoals.every((goal) => goal.isDone());
  const hasEnoughRep = factionRepGoals.every((goal) => goal.isDone());

  if (inTargetFactions && hasEnoughMoney && hasEnoughRep) {
    for (const hostname of nmap(ns))
      for (const { pid } of ns.ps(hostname))
        if (pid !== ns.pid) {
          ns.ui.closeTail(pid);
          ns.kill(pid);
        }

    ns.tprint(`I'm the scheduler now!`);
    const finisher = ['home', 'THREADPOOL-01']
      .filter((hostname) => ns.serverExists(hostname))
      .sort(
        by(
          (hostname) =>
            -(ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname)),
        ),
      )[0];
    ns.tprint(
      `Using ${finisher} (${ns.getServerMaxRam(finisher)}) as Singularity server`,
    );

    /** @param {string} script
     *  @param {number} threads
     *  @param { ...ScriptArg} args*/
    const run = async (script, threads, ...args) => {
      ns.tprint(`${script} ${args.join(' ')}`);
      const pid = ns.exec(script, finisher, threads, ...args);
      ns.tprint(pid);
      if (pid === 0) {
        ns.tprint(' failed to run');
      } else {
        while (ns.isRunning(pid)) await ns.sleep(50);
        ns.tprint(' done');
      }
    };

    const buyRepGoal = goals.find((goal) => goal.type === 'BUY_REP');
    if (buyRepGoal != null) {
      const donationRate = ns.formulas.reputation.donationForRep(1, ns.getPlayer());
      await run('/bin/self/aug/donate-to-faction.js', 1, buyRepGoal.faction, buyRepGoal.requirement * donationRate);
    }

    // Sell all stocks
    if (ns.stock.hasTixApiAccess()) dump(ns);

    ns.tprint(
      `Attempting to purchase ${targetAugmentations.length} augmentations`,
    );

    for (const augmentation of targetAugmentations) {
      const bought = factions.some((faction) =>
        ns.singularity.purchaseAugmentation(faction, augmentation),
      );
      ns.tprint(`  Purchase ${augmentation}?: ${bought}`);
    }

    // Spend what's left on Neuroflux
    let nfCount = 0;
    while (
      factions.some((faction) =>
        ns.singularity.purchaseAugmentation(faction, NEUROFLUX),
      )
    )
      nfCount++;
    ns.tprint(`  bought ${nfCount} Neuroflux`);

    // Buy RAM if we can
    await run('/bin/self/buy-ram.js', 1);

    // Try to start next aug with market access
    await run('/bin/broker/purchase.js', 1, 'purchaseWseAccount');
    await run('/bin/broker/purchase.js', 1, 'purchaseTixApi');
    await run('/bin/broker/purchase.js', 1, 'purchase4SMarketDataTixApi');
    await run('/bin/broker/purchase.js', 1, 'purchase4SMarketData');

    const { factionFavor, favorToDonate, augmentationRepReqs } = getStaticData(ns);
    const highestFavorFaction = ns.getPlayer().factions.reduce((f1, f2) => factionFavor[f1] > factionFavor[f2] ? f1 : f2);
    if (factionFavor[highestFavorFaction] >= favorToDonate) {
      const ownedAugs = ns.singularity.getOwnedAugmentations(true);
      let neurofluxExponent = ownedAugs.filter((aug) => aug === NEUROFLUX).length;
      do {
        neurofluxExponent++;
        const repOfNextNeuroflux = augmentationRepReqs[NEUROFLUX] * 1.14 ** neurofluxExponent;
        const donationRate = ns.formulas.reputation.donationForRep(1, ns.getPlayer());
        const currentRep = ns.singularity.getFactionRep(highestFavorFaction);
        if (currentRep < repOfNextNeuroflux) {
          await run('/bin/self/aug/donate-to-faction.js', 1, highestFavorFaction, (repOfNextNeuroflux - currentRep) * donationRate);
        }
      } while(ns.singularity.purchaseAugmentation(highestFavorFaction, NEUROFLUX));
    }

    const allPurchases = ns.singularity.getOwnedAugmentations(true);
    ns.write('/tmp/last-reset.txt', ns.format.time(Date.now()) + '\n' + allPurchases.join('\n'), 'w');

    // Start all over
    await run('/bin/self/aug/install.js', 1);
  } else {
    const lines = [
      `purchase-augs: no trigger @ ${new Date().toISOString()}`,
      `  inTargetFactions=${inTargetFactions}  factionJoinGoals=[${factionJoinGoals.map((g) => `${g.faction}:${g.isDone()}`).join(', ')}]`,
      `  hasEnoughRep=${hasEnoughRep}  factionRepGoals=[${factionRepGoals.map((g) => `${g.faction}:${g.isDone()}(req=${g.requirement})`).join(', ')}]`,
      `  hasEnoughMoney=${hasEnoughMoney}  money=${ns.format.number(money, 3)}`,
      `  targetAugmentations=${JSON.stringify(targetAugmentations)}`,
      `  goalTypes=${JSON.stringify(goals.map((g) => g.type))}`,
    ].join('\n');
    ns.write('/tmp/purchase-augs-debug.txt', lines, 'w');
  }
}

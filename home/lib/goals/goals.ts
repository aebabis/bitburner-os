import { getStaticData, getPlayerData, getMoneyData } from '../data-store.ts';
import { THREADPOOL } from '../../etc/config.ts';
import {
  jobRamGoal,
  installGoal,
  reevaluateGoal,
  type Goal,
  hackingXpGoal,
  moneyPrereqGoal,
} from './nodes.ts';
import {
  buildFactionGoalTree,
  buildJoinSubtree,
  getBladeburnerTree,
  isRepBound as isRepBoundPure,
} from './tree.ts';
import { getAccessibleFactions, computeResetOverhead } from '../aug-select.ts';
import { formulas as getFormulas } from '../formulas.ts';
import { needsAugRam, needsJobRam } from '../query-service.ts';
import { recordGoalSnapshot } from '../goal-tracker.ts';

export const getGoals = (ns: NS): Goal => {
  const { player, factionRep, purchasedAugmentations = [] } = getPlayerData(ns);
  const { money } = player;
  const staticData = getStaticData(ns);
  const { currentNode } = staticData.resetInfo;
  const { requiredJobRam, requiredAugRam, purchasedServerCosts } = staticData;
  const { estimatedStockValue = 0, referenceIncome = 0 } = getMoneyData(ns);
  const formulas = getFormulas(ns);
  const karma = ns.heart.break();
  const ownedAugs = [
    ...staticData.installedAugmentations,
    ...purchasedAugmentations,
  ];
  const planData = {
    player,
    staticData,
    factionRep: factionRep ?? {},
    purchasedAugmentations,
    ownedAugs,
    money,
    estimatedStockValue,
    referenceIncome,
    formulas,
    karma,
  };

  if (currentNode === 2 && !player.factions?.includes('Slum Snakes')) {
    const joinGoal = buildJoinSubtree('Slum Snakes', {
      player,
      staticData,
      money,
      referenceIncome,
      karma,
      formulas,
    });
    return reevaluateGoal(joinGoal);
  }

  const THE_BLADE = "The Blade's Simulacrum";
  const hasBlade = staticData.resetInfo.ownedAugs.has(THE_BLADE);
  if ([6, 7].includes(currentNode) && !hasBlade) {
    const bladeTree = getBladeburnerTree(
      getStaticData(ns),
      getPlayerData(ns),
      getMoneyData(ns),
      ns.bladeburner.inBladeburner(),
    );
    if (bladeTree != null) {
      return bladeTree;
    }
  }

  if (currentNode === 8 && !ns.stock.has4SDataTixApi()) {
    const target = ns.stock.getConstants().MarketDataTixApi4SCost;
    return reevaluateGoal(
      moneyPrereqGoal(target, estimatedStockValue + money, referenceIncome),
    );
  }

  const universityGains = formulas.work.universityGains(
    player,
    'Algorithms',
    ns.enums.LocationName.Sector12RothmanUniversity,
  );
  const xpRate = universityGains.hackExp * 5;
  const targetHackingXp = xpRate * 10;
  if (player.exp.hacking < targetHackingXp)
    return reevaluateGoal(
      hackingXpGoal(
        targetHackingXp,
        player.exp.hacking,
        (targetHackingXp - player.exp.hacking) / xpRate,
      ),
    );

  const overhead = computeResetOverhead(staticData);

  const plans = getAccessibleFactions(staticData, player, ownedAugs)
    .map((f) => buildFactionGoalTree(f, planData))
    .filter(/** @type {<T>(x: T | null) => x is T} */ Boolean);
  const bestPlan =
    plans.length > 0
      ? plans.reduce((a, b) =>
          a.utility(overhead) >= b.utility(overhead) ? a : b,
        )
      : null;

  const selectedFaction =
    bestPlan?.prerequisites('FACTION_JOIN')[0]?.faction ?? null;
  recordGoalSnapshot(plans, selectedFaction, overhead);

  const POOL1 = `${THREADPOOL}-01`;
  const pool1Ram = ns.serverExists(POOL1) ? ns.getServerMaxRam(POOL1) : 0;
  const makeRamGoal = (size: number, cost: number) =>
    jobRamGoal(POOL1, pool1Ram, size, cost, money, referenceIncome);

  if (bestPlan) {
    const ramGoals = [];

    if (needsAugRam(ns)) {
      const augRamCost = purchasedServerCosts?.[requiredAugRam] ?? 0;
      ramGoals.push(makeRamGoal(requiredAugRam, augRamCost));
    }

    if (needsJobRam(ns) && referenceIncome > 0) {
      const baselineTTC = Math.max(
        ...bestPlan.deps.map((g) => g.timeToComplete() ?? Infinity),
      );
      const jobRamCost = purchasedServerCosts?.[requiredJobRam] ?? 0;
      if (jobRamCost / referenceIncome < baselineTTC)
        ramGoals.push(makeRamGoal(requiredJobRam, jobRamCost));
    }

    return installGoal([...bestPlan.deps, ...ramGoals], bestPlan.actions);
  }

  const jobRamCost = purchasedServerCosts?.[requiredJobRam] ?? 0;
  const jrg = jobRamGoal(
    POOL1,
    pool1Ram,
    requiredJobRam,
    jobRamCost,
    money,
    referenceIncome,
  );
  return reevaluateGoal(jrg);
};

export const getTimeToMilestone = (ns: NS): number | null => {
  const root = getGoals(ns);
  const joinGoal = root.prerequisites('FACTION_JOIN').find((g) => !g.isDone());
  if (joinGoal) return joinGoal.timeToComplete();
  return root.timeToComplete();
};

export const getTimeToComplete = (ns: NS): number | null => {
  return getGoals(ns).timeToComplete();
};

/**
 * @param {NS} ns
 * @param {import('./nodes.ts').Goal} [root]
 * @returns {boolean}
 */
export const isRepBound = (ns, root = getGoals(ns)) => isRepBoundPure(root);

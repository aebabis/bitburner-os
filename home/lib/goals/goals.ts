import { getStaticData, getPlayerData, getMoneyData, type StaticData } from '../data-store.ts';
import {
  installGoal,
  reevaluateGoal,
  type Goal,
  type Plan,
  hackingXpGoal,
  moneyPrereqGoal,
  rebootGoal,
  homeRamGoal,
  karmaGoal,
  labyrinthGoal,
} from './nodes.ts';
import {
  buildFactionGoalTree,
  buildJoinSubtree,
  getBladeburnerTree,
  isRepBound as isRepBoundPure,
} from './tree.ts';
import { getAccessibleFactions, computeResetOverhead } from '../aug-select.ts';
import { formulas as getFormulas } from '../formulas.ts';
import { getIncome } from '../query-service.ts';
import { recordGoalSnapshot } from '../goal-tracker.ts';
import { hasBladeburnerReadyMults } from '../../bin/blades/is-ready.ts';

// Computes additional overhead if the player was given a free BN9
// server at the start of the run to account for the time it would
// take to earn the server normally.
// Server is granted at the start of BN9 or if the player has all
// three levels of BN9 unlocked.
const startingServerOverhead = (
  staticData: StaticData,
  totalIncome: number,
  hacknetIncome: number,
): number => {
  const { currentNode, ownedSF, lastAugReset, lastNodeReset } = staticData.resetInfo;
  const isFirstCycle = lastAugReset === lastNodeReset;
  const getsFreeHacknetServers = currentNode === 9 || ownedSF.get(9) === 3;
  if (!getsFreeHacknetServers || !isFirstCycle) return 0;
  const incomeRate = totalIncome - hacknetIncome;
  return incomeRate > 0 ? staticData.startingServerValue / incomeRate : 0;
};

export const getGoals = (ns: NS): Goal => {
  const {
    player,
    factionRep,
    homeRam,
    homeRamUpgradeCost = 0,
    access4SDataApi,
    queuedAugmentations = [],
    fragmentMultipliers,
  } = getPlayerData(ns);
  const { money } = player;
  const staticData = getStaticData(ns);
  const { currentNode, ownedSF, ownedAugs: installedAugs } = staticData.resetInfo;
  const { estimatedStockValue = 0 } = getMoneyData(ns);
  const { totalIncome = 0, hacknetIncome = 0 } = getIncome(ns);
  const formulas = getFormulas(ns) as unknown as Formulas;
  const karma = ns.heart.break();
  const ownedAugs = [...staticData.installedAugmentations, ...queuedAugmentations];

  const overhead =
    computeResetOverhead(staticData) +
    startingServerOverhead(staticData, totalIncome, hacknetIncome);

  const planData = {
    player,
    staticData,
    factionRep: factionRep ?? {},
    queuedAugmentations,
    ownedAugs,
    money,
    estimatedStockValue,
    totalIncome,
    formulas,
    karma,
    overhead,
    fragmentMultipliers,
  };

  const plans = getAccessibleFactions(staticData, player, ownedAugs)
    .map((f) => buildFactionGoalTree(ns, f as FactionName, planData))
    .filter((x): x is Plan => x !== null);
  const bestPlan =
    plans.length > 0
      ? plans.reduce((a, b) => (a.utility(overhead) >= b.utility(overhead) ? a : b))
      : null;

  const selectedFaction = bestPlan?.prerequisites('FACTION_JOIN')[0]?.faction ?? null;
  recordGoalSnapshot(plans, selectedFaction, overhead);

  // If player has singularity access but not all of SF4,
  // the static augmentation data may have not loaded during boot.
  // If this is the case, make a goal for more RAM on home.
  if (staticData.resetInfo.ownedSF.has(4) && staticData.augmentations == null) {
    const bootRam = staticData.scriptRam['/boot/data4.ts'];
    const money = moneyPrereqGoal(homeRamUpgradeCost, player.money, totalIncome);
    const targetRam = 2 ** Math.ceil(Math.log2(bootRam));
    return rebootGoal(homeRamGoal(homeRam, targetRam, money));
  }

  const inSlumSnakes = player.factions?.includes('Slum Snakes');
  if (currentNode === 2 && !inSlumSnakes) {
    const joinGoal = buildJoinSubtree('Slum Snakes', {
      player,
      staticData,
      money,
      totalIncome,
      karma,
      formulas,
      fragmentMultipliers,
    });
    return reevaluateGoal(joinGoal);
  }

  if ([3, 7].includes(currentNode) && (ownedSF.get(currentNode) ?? 0) >= 1 && !ns.gang.inGang()) {
    const joinGoal = buildJoinSubtree('Slum Snakes', {
      player,
      staticData,
      money,
      totalIncome,
      karma,
      formulas,
      fragmentMultipliers,
    });
    return reevaluateGoal(karmaGoal(-54000, karma, [joinGoal]));
  }

  const THE_BLADE = "The Blade's Simulacrum";
  const hasBlade = installedAugs.has(THE_BLADE);
  if ([6, 7].includes(currentNode) && !hasBlade) {
    if (hasBladeburnerReadyMults(player)) {
      return getBladeburnerTree(
        getStaticData(ns),
        getPlayerData(ns),
        getMoneyData(ns),
        totalIncome,
        ns.bladeburner.inBladeburner(),
      );
    }
  }

  if (currentNode === 8 && !access4SDataApi) {
    const target = ns.stock.getConstants().MarketDataTixApi4SCost;
    return reevaluateGoal(moneyPrereqGoal(target, estimatedStockValue + money, totalIncome));
  }

  const THE_RED_PILL = 'The Red Pill';
  if (currentNode === 15 && !ownedAugs.includes(THE_RED_PILL)) {
    const CHARISMA_TARGETS = [300, 600, 1500, 2500, 3000, 3500, 4000, 4000];
    const isLabyAug = (aug: string) => aug.match(/^The [a-zA-Z0-9]+ of [a-zA-Z]+/);
    const installedLabyAugs = [...installedAugs.keys()].filter(isLabyAug);
    const hasQueuedLabyAug = queuedAugmentations.some(isLabyAug);
    const currentCharismaTarget = CHARISMA_TARGETS[installedLabyAugs.length];
    if (!hasQueuedLabyAug && player.skills.charisma >= currentCharismaTarget) {
      return reevaluateGoal(labyrinthGoal(installedLabyAugs.length));
    }
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

  if (bestPlan) {
    return installGoal([...bestPlan.deps], bestPlan.actions);
  } else {
    const bootRam = staticData.scriptRam['/boot/data4.ts'];
    const money = moneyPrereqGoal(homeRamUpgradeCost, player.money, totalIncome);
    const targetRam = 2 ** Math.ceil(Math.log2(bootRam));
    return rebootGoal(homeRamGoal(homeRam, targetRam, money));
  }
};

export const getTimeToMilestone = (ns: NS): number | null => {
  const root = getGoals(ns);
  const joinGoal = root.prerequisites('FACTION_JOIN').find((g) => !g.isDone());
  if (joinGoal) return joinGoal.timeToComplete();
  return root.timeToComplete();
};

export const isRepBound = (ns: NS, root = getGoals(ns)) => isRepBoundPure(root);

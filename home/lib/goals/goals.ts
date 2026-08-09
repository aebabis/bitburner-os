import {
  getStaticData,
  getPlayerData,
  getMoneyData,
  hasSingularityData,
  type StaticData,
} from '../data-store.ts';
import {
  installGoal,
  reevaluateGoal,
  type Goal,
  type Plan,
  hackingXpGoal,
  moneyPrereqGoal,
  rebootGoal,
  homeRamGoal,
  horizonGoal,
  NEVER,
  augMoneyGoal,
  karmaGoal,
  labyrinthGoal,
  waitGoal,
} from './nodes.ts';
import { HORIZON_MS } from '../../etc/config.ts';
import {
  buildFactionGoalTree,
  buildJoinSubtree,
  getBladeburnerJoinTree,
  getBladeburnerTree,
  isRepBound as isRepBoundPure,
} from './tree.ts';
import { getAccessibleFactions, computeResetOverhead } from '../aug-select.ts';
import { formulas as getFormulas } from '../formulas.ts';
import { gangsAllowed, getIncome } from '../query-service.ts';
import { recordGoalSnapshot } from '../goal-tracker.ts';
import { hasBladeburnerReadyMults } from '../../bin/blades/is-ready.ts';
import { RED_PILL, THE_BLADE } from '../../etc/augmentations.ts';

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
  const playerData = getPlayerData(ns);
  const {
    player,
    factionRep,
    homeRam,
    homeRamUpgradeCost = 0,
    access4SDataApi,
    queuedAugmentations = [],
    fragmentMultipliers,
    hacknet,
    bladeburnerRepRate,
  } = playerData;
  const { money } = player;
  const staticData = getStaticData(ns);
  const { currentNode, ownedSF, ownedAugs: installedAugs } = staticData.resetInfo;
  const hasNode = (n: number) => ownedSF.has(n) || currentNode === n;
  const { estimatedStockValue = 0 } = getMoneyData(ns);
  const { totalIncome = 0, hacknetIncome = 0 } = getIncome(ns);
  const formulas = getFormulas(ns) as unknown as Formulas;
  const karma = ns.heart.break();
  const ownedAugs = [...staticData.installedAugmentations, ...queuedAugmentations];

  if (totalIncome <= 0) {
    return reevaluateGoal(waitGoal('Wait for income data'));
  }

  if (!hasNode(4)) {
    // Determining target augmentations impossible without SF4 data.
    // Return reasonable, fixed horizon so consumers have a reference point for ROI.
    // Already-complete augMoneyGoal provided as future-proofing.
    return horizonGoal(HORIZON_MS / 1000, [augMoneyGoal(money, money, totalIncome)]);
  }

  // If player has singularity access but not all of SF4,
  // the static augmentation data may have not loaded during boot.
  // If this is the case, make a goal for more RAM on home.
  if (!hasSingularityData(staticData)) {
    const bootScriptRam = Object.entries(staticData.scriptRam)
      .filter(([script]) => script.match(/^boot/))
      .map(([_, ram]) => ram);
    const bootRam = Math.max(...bootScriptRam);
    const money = moneyPrereqGoal(homeRamUpgradeCost, player.money, totalIncome);
    const targetRam = 2 ** Math.ceil(Math.log2(bootRam));
    return rebootGoal(homeRamGoal(homeRam, targetRam, money));
  }

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
    hacknetServers: hacknet?.servers,
    bladeburnerRepRate,
  };

  const plans = getAccessibleFactions(staticData, player, ownedAugs)
    .map((f) => buildFactionGoalTree(ns, f as FactionName, planData))
    .filter((x): x is Plan => x !== null);
  const bestPlan =
    plans.length > 0
      ? plans.reduce((a, b) => (a.utility(overhead) >= b.utility(overhead) ? a : b))
      : null;

  const selectedFaction = bestPlan?.prerequisites('FACTION_JOIN')[0]?.faction ?? null;
  // Record selectedFaction for the purposes of visually verifying faction math.
  // Tracks best faction, even if a non-faction goal tree is chosen.
  recordGoalSnapshot(plans, selectedFaction, overhead);

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

  const sfLevel = ownedSF.get(currentNode) ?? 0;
  // Subsequent playthroughs of BN3 and BN7 are difficult enough that gangs help
  const isGangHelpful = [3, 7].includes(currentNode) && sfLevel >= 1;
  if (gangsAllowed(staticData) && isGangHelpful && !ns.gang.inGang() && karma > -54000) {
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

  const hasBlade = installedAugs.has(THE_BLADE);
  if ([6, 7].includes(currentNode) && !hasBlade) {
    if (hasBladeburnerReadyMults(player)) {
      return getBladeburnerTree(
        staticData,
        playerData,
        getMoneyData(ns),
        totalIncome,
        ns.bladeburner.inBladeburner(),
        formulas,
        staticData.bitNodeMultipliers,
      );
    }
  } else if (ownedSF.get(7) === 3 && currentNode !== 8) {
    const joinTree = getBladeburnerJoinTree(
      playerData,
      ns.bladeburner.inBladeburner(),
      formulas,
      staticData.bitNodeMultipliers,
    );
    if (!joinTree.isDone() && joinTree.timeToComplete() < 60) return reevaluateGoal(joinTree);
  }

  if (currentNode === 8 && !access4SDataApi) {
    const target = ns.stock.getConstants().MarketDataTixApi4SCost;
    return reevaluateGoal(moneyPrereqGoal(target, estimatedStockValue + money, totalIncome));
  }

  if (currentNode === 10 && !player.factions.includes('The Covenant')) {
    const covTree = buildJoinSubtree('The Covenant', {
      player,
      staticData,
      money,
      totalIncome,
      karma,
      formulas,
      fragmentMultipliers,
    });
    const ttc = covTree.timeToComplete();
    if (ttc < 4 * 60) {
      return covTree;
    }
  }

  if (currentNode === 15 && !ownedAugs.includes(RED_PILL)) {
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
  }

  throw new Error('Unable to make goal tree. This should never happen (NFG can always be pursued)');
};

export const getTimeToMilestone = (ns: NS): number => {
  const root = getGoals(ns);
  const joinGoal = root.prerequisites('FACTION_JOIN').find((g) => !g.isDone());
  if (joinGoal) return joinGoal.timeToComplete();
  return root.timeToComplete();
};

/**
 * Provides time table for consumers to act.
 */
export const getPlanningHorizon = (ns: NS): number => {
  const ttc = getTimeToMilestone(ns);
  return ttc >= NEVER ? HORIZON_MS / 1000 : ttc;
};

export const isRepBound = (ns: NS, root = getGoals(ns)) => isRepBoundPure(root);

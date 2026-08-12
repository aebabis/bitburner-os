import {
  factionRepGoal,
  augMoneyGoal,
  buyAugAction,
  buyRepAction,
  factionJoinGoal,
  eitherGoal,
  mutexGoal,
  hackingLevelGoal,
  combatLevelsGoal,
  killsGoal,
  karmaGoal,
  moneyPrereqGoal,
  locationGoal,
  factionFavorGoal,
  installGoal,
  COMBAT_STATS,
  hacknetGoal,
  type Action,
  type Goal,
  type Plan,
  type CombatStat,
  bladesJoinGoal,
  neverGoal,
  waitGoal,
} from './nodes.ts';
import {
  findOptimalBatch,
  computeRepReq,
  computeAugCost,
  augValueFromStats,
  shouldEarlyInstall,
  shouldPursueFavor,
  computeRepRate,
} from '../aug-select.ts';
import { MoneyData, PlayerData, SF4StaticData } from '../data-store.ts';
import { getAugWeights } from '../aug-weights.ts';
import { getMockFormulas, MockFormulas } from '../formulas.ts';
import { THE_BLADE } from '../../etc/augmentations.ts';

const plan = (deps: Goal[], actions: Action[], utility: (overhead: number) => number): Plan =>
  Object.assign(installGoal(deps, actions), { utility });

// Port program costs in purchase order; used to estimate backdoor access cost.
// TODO: Exclude programs the player already owns; consider fetching costs via ns.
const PORT_PROGRAM_COSTS = [500e3, 1500e3, 5e6, 30e6, 250e6];

const GymStats = {
  strength: 'str',
  defense: 'def',
  dexterity: 'dex',
  agility: 'agi',
} as const;
const GymExp = {
  strength: 'strExp',
  defense: 'defExp',
  dexterity: 'dexExp',
  agility: 'agiExp',
} as const;
const LEVEL_MULT_KEY = {
  hacking: 'HackingLevelMultiplier',
  strength: 'StrengthLevelMultiplier',
  defense: 'DefenseLevelMultiplier',
  dexterity: 'DexterityLevelMultiplier',
  agility: 'AgilityLevelMultiplier',
} as const;

const SKILL_FRAGMENT_TYPE: Record<CombatStat | 'hacking', FragmentType> = {
  hacking: 6,
  strength: 7,
  defense: 8,
  dexterity: 9,
  agility: 10,
};

// While Stanek is actively charging a stat's fragment, that stat's displayed skill is inflated
// by the fragment's level multiplier on top of real exp — training only until the *boosted*
// skill hits the real requirement leaves the stat below requirement once the boost fades (e.g.
// once love moves on to training another stat, which resets the previous stat's fragment
// charge — see home/bin/stanek.ts). Scale the requirement up by the current multiplier so the
// stat is still at or above the real requirement after the boost fades.
const combatRequirement = (
  baseReq: number,
  stat: CombatStat,
  fragmentMultipliers: Record<FragmentType, number> | undefined,
) => baseReq * (fragmentMultipliers?.[SKILL_FRAGMENT_TYPE[stat]] ?? 1);

// Same compensation as combatRequirement, for hacking's own Stanek fragment.
const hackingRequirement = (
  baseReq: number,
  fragmentMultipliers: Record<FragmentType, number> | undefined,
) => baseReq * (fragmentMultipliers?.[SKILL_FRAGMENT_TYPE.hacking] ?? 1);

const skillTrainingTime = (
  player: Player,
  stat: 'hacking' | 'strength' | 'defense' | 'dexterity' | 'agility',
  requirement: number,
  formulas: MockFormulas | Formulas,
  bitNodeMultipliers: BitNodeMultipliers | null,
) => {
  const mult = player.mults[stat] * (bitNodeMultipliers?.[LEVEL_MULT_KEY[stat]] ?? 1);
  const currentExp = player.exp[stat];
  const expReq = formulas.skills.calculateExp(requirement, mult);
  const expNeeded = Math.max(0, expReq - currentExp);
  if (stat === 'hacking') {
    const gains = formulas.work.universityGains(player, 'Algorithms', 'Rothman University');
    const expRate = gains.hackExp * 5;
    return expNeeded / expRate;
  } else {
    const gains = formulas.work.gymGains(player, GymStats[stat], 'Powerhouse Gym');
    const expRate = gains[GymExp[stat]] * 5;
    return expNeeded / expRate;
  }
};

export const combatMutexGoal = (
  combatReq: number,
  player: Player,
  formulas: MockFormulas | Formulas,
  bitNodeMultipliers: BitNodeMultipliers | null,
  fragmentMultipliers: Record<FragmentType, number> | undefined,
  blockers: Goal[] = [],
) =>
  mutexGoal(
    COMBAT_STATS.map((stat) => {
      const req = combatRequirement(combatReq, stat, fragmentMultipliers);
      const t = skillTrainingTime(player, stat, req, formulas, bitNodeMultipliers);
      return combatLevelsGoal(req, stat, player.skills, t, combatReq);
    }),
    `${combatReq} in combat stats`,
    blockers,
  );

const getHacknetGoal = (
  factionRequirements: PlayerRequirement[],
  servers: NodeStats[],
  formulas: MockFormulas | Formulas,
  income: number,
  mults: HacknetMultipliers,
) => {
  const ramReq = factionRequirements.find((req) => req.type === 'hacknetRAM');
  const coreReq = factionRequirements.find((req) => req.type === 'hacknetCores');
  const levelReq = factionRequirements.find((req) => req.type === 'hacknetLevels');
  if (ramReq == null && coreReq == null && levelReq == null) return null;

  const targetCores = coreReq?.hacknetCores ?? 1;
  const targetRam = ramReq?.hacknetRAM ?? 0;
  const targetLevels = levelReq?.hacknetLevels ?? 0;

  const currentCores = servers.map((server) => server.cores).reduce((a, b) => a + b, 0);
  const currentRam = servers.map((server) => server.ram).reduce((a, b) => a + b, 0);
  const currentLevels = servers.map((server) => server.level).reduce((a, b) => a + b, 0);

  if (currentCores >= targetCores && currentRam >= targetRam && currentLevels >= targetLevels)
    return null;

  // Disallow Netburners without Formulas.exe
  // planner already prohibits hacknet without it; duplicated here for type safety
  if (!('hacknetServers' in formulas)) return neverGoal();

  const plannedServers = Array(targetCores)
    .fill(0)
    .map((_, i) => servers[i] ?? { level: 1, ram: 1, cores: 1 });
  const ramPerServer = Math.ceil(targetRam / targetCores);
  const levelsPerServer = Math.ceil(targetLevels / targetCores);

  const serverCost =
    servers.length > targetCores
      ? 0
      : Array(targetCores - servers.length)
          .fill(0)
          .map((_, i) =>
            formulas.hacknetServers.hacknetServerCost(servers.length + i + 1, mults.purchaseCost),
          )
          .reduce((a, b) => a + b, 0);
  const ramCost = plannedServers
    .map((server) => {
      let ram = server.ram;
      let cost = 0;
      while (ram < ramPerServer) {
        cost += formulas.hacknetServers.ramUpgradeCost(ram, 1, mults.ramCost);
        ram *= 2;
      }
      return cost;
    })
    .reduce((a, b) => a + b, 0);
  const levelCost = plannedServers
    .map((server) => {
      let cost = 0;
      for (let level = server.level; level < levelsPerServer; level++) {
        cost += formulas.hacknetServers.levelUpgradeCost(level, 1, mults.levelCost);
      }
      return cost;
    })
    .reduce((a, b) => a + b, 0);

  return mutexGoal([
    hacknetGoal('hacknetCores', targetCores, currentCores, serverCost, income),
    hacknetGoal('hacknetRAM', targetRam, currentRam, ramCost, income),
    hacknetGoal('hacknetLevels', targetLevels, currentLevels, levelCost, income),
  ]);
};

/**
 * Build the join prereq subtree for a faction.
 * Returns early (already-joined short-circuit) when player is already a member.
 */
export const buildJoinSubtree = (
  faction: FactionName,
  {
    player,
    staticData,
    money,
    totalIncome,
    karma,
    formulas,
    fragmentMultipliers,
    hacknetServers = [],
    graftGoal = null,
  }: {
    player: Player;
    staticData: SF4StaticData;
    money: number;
    totalIncome: number;
    karma: number;
    formulas: MockFormulas | Formulas;
    fragmentMultipliers?: Record<FragmentType, number>;
    hacknetServers?: NodeStats[];
    graftGoal?: Goal | null;
  },
) => {
  const { factions, skills, city } = player;
  const { serverBackdoorRequirements } = staticData;
  const { factionRequirements } = staticData.singularityData;

  const gate = graftGoal ? [graftGoal] : [];

  if (factions.includes(faction)) {
    return factionJoinGoal(faction, factions, []);
  }

  const joinPrereqs = [];
  const requirements = factionRequirements?.[faction] ?? [];
  const skillReqs = Object.assign(
    {},
    ...requirements.filter((r) => r.type === 'skills').map((r) => r.skills),
  );
  const karmaReq = requirements.find((r) => r.type === 'karma')?.karma ?? 0;
  const killsReq = requirements.find((r) => r.type === 'numPeopleKilled')?.numPeopleKilled ?? 0;
  const moneyTarget = requirements.find((r) => r.type === 'money')?.money ?? 0;
  const locationReqs = [
    ...requirements.filter((r) => r.type === 'city'),
    ...requirements
      .filter((r) => r.type === 'someCondition')
      .flatMap((r) => r.conditions)
      .filter((r) => r.type === 'city'),
  ].map((r) => r.city);

  const bdReq = requirements.find((r) => r.type === 'backdoorInstalled');
  let bdHackReq = 0,
    bdMoney = 0;
  if (bdReq && serverBackdoorRequirements) {
    const serverReq = serverBackdoorRequirements.find((s) => s.hostname === bdReq.server);
    if (serverReq) {
      bdHackReq = serverReq.requiredHackingLevel;
      bdMoney = PORT_PROGRAM_COSTS.filter((_, i) => i < serverReq.numPortsRequired).reduce(
        (a, b) => a + b,
        0,
      );
    }
  }

  const hacknetGoals = getHacknetGoal(
    requirements,
    hacknetServers,
    formulas,
    totalIncome,
    staticData.hacknetMultipliers,
  );
  if (hacknetGoals != null) {
    joinPrereqs.push(hacknetGoals);
  }

  // Combine explicit skill req with backdoor hacking req; only one goal needed.
  const hackReq = Math.max(skillReqs.hacking ?? 0, bdHackReq) || null;
  const combatReq = skillReqs.strength ?? null;

  if (hackReq != null) {
    const req = hackingRequirement(hackReq, fragmentMultipliers);
    const t = skillTrainingTime(player, 'hacking', req, formulas, staticData.bitNodeMultipliers);
    joinPrereqs.push(hackingLevelGoal(req, skills.hacking ?? 0, t, gate));
  }
  if (combatReq != null) {
    joinPrereqs.push(
      combatMutexGoal(
        combatReq,
        player,
        formulas,
        staticData.bitNodeMultipliers,
        fragmentMultipliers,
        gate,
      ),
    );
  }
  // Some factions (e.g. Daedalus) gate on alternative skill paths, e.g.
  // (hacking >= X) OR (all combat stats >= Y), expressed via someCondition.
  const buildSkillGoal = (req: Partial<Skills>) => {
    if (req.hacking) {
      const hReq = hackingRequirement(req.hacking, fragmentMultipliers);
      const t = skillTrainingTime(player, 'hacking', hReq, formulas, staticData.bitNodeMultipliers);
      return hackingLevelGoal(hReq, skills.hacking ?? 0, t, gate);
    }
    const cReq = Math.max(0, ...COMBAT_STATS.map((stat) => req[stat] ?? 0));
    if (cReq > 0) {
      return combatMutexGoal(
        cReq,
        player,
        formulas,
        staticData.bitNodeMultipliers,
        fragmentMultipliers,
        gate,
      );
    }
    return null;
  };
  const someConditionGoals = requirements
    .filter((r) => r.type === 'someCondition')
    .map((r) => {
      const branches = r.conditions
        .filter((c) => c.type === 'skills')
        .map((c) => buildSkillGoal(c.skills))
        .filter((g) => g != null);
      if (branches.length === 0) return null;
      return branches.length === 1 ? branches[0] : eitherGoal(branches);
    })
    .filter((g) => g != null);
  joinPrereqs.push(...someConditionGoals);

  if (killsReq) joinPrereqs.push(killsGoal(killsReq, player.numPeopleKilled ?? 0, gate));
  if (karmaReq) joinPrereqs.push(karmaGoal(karmaReq, karma, gate));
  const totalMoneyTarget = moneyTarget + bdMoney;
  if (totalMoneyTarget > 0) joinPrereqs.push(moneyPrereqGoal(totalMoneyTarget, money, totalIncome));
  const locGoals = locationReqs.map((loc) => locationGoal(loc, city, gate));
  if (locGoals.length > 0) {
    const locGoal = locGoals.length === 1 ? locGoals[0] : eitherGoal(locGoals);
    joinPrereqs.push(locGoal);
  }

  return factionJoinGoal(faction, factions, joinPrereqs);
};

export const isRepBound = (root: Goal) => {
  const unmetRepGoals = root.prerequisites('FACTION_REP').filter((g) => !g.isDone());
  const maxRepTime =
    unmetRepGoals.length > 0 ? Math.max(...unmetRepGoals.map((g) => g.timeToComplete())) : 0;
  const [amg] = root.prerequisites('AUG_MONEY');
  // No money target at all: rep is the only thing left to wait on.
  if (amg == null) return true;
  // If install goal is donation, then rep time and money
  // time will be nearly equal by construction. Make rep
  // win ties.
  return maxRepTime > amg.timeToComplete() - 1;
};

/**
 * Build the complete goal chain for one candidate faction plan.
 * Returns null if findOptimalBatch finds nothing worth pursuing.
 */
interface FactionGoalTreeProps {
  player: Player;
  staticData: SF4StaticData;
  factionRep: Record<string, number>;
  queuedAugmentations: string[];
  ownedAugs: string[];
  money: number;
  estimatedStockValue?: number;
  totalIncome: number;
  formulas: ReturnType<typeof getMockFormulas>;
  karma: number;
  overhead: number;
  fragmentMultipliers?: Record<FragmentType, number>;
  hacknetServers?: NodeStats[];
  bladeburnerRepRate?: number; // computed separately by burners.ts
  graftGoal?: Goal | null; // in-progress graft blocking all player actions
}
export const buildFactionGoalTree = (
  ns: NS,
  faction: FactionName,
  {
    player,
    staticData,
    factionRep,
    queuedAugmentations,
    ownedAugs,
    money,
    estimatedStockValue = 0,
    totalIncome,
    formulas,
    karma,
    overhead,
    fragmentMultipliers,
    hacknetServers,
    bladeburnerRepRate = 0,
    graftGoal = null,
  }: FactionGoalTreeProps,
): Plan | null => {
  const { augmentationStats, factionWorkTypes, factionFavor } = staticData.singularityData;
  const gate = graftGoal ? [graftGoal] : [];
  const graftTime = graftGoal?.timeToComplete() ?? 0;
  const augWeights = getAugWeights(staticData.resetInfo);
  const augValue = (aug: string) => augValueFromStats(augWeights, aug, augmentationStats);

  const moneyRate = totalIncome || Infinity;
  const liquidAssets = money + estimatedStockValue;

  const joinGoal = buildJoinSubtree(faction, {
    player,
    staticData,
    money,
    totalIncome,
    karma,
    formulas,
    fragmentMultipliers,
    hacknetServers,
    graftGoal,
  });
  const joinTime = joinGoal.timeToComplete();

  const { batch: augs } = findOptimalBatch(
    faction,
    staticData,
    player,
    formulas,
    factionRep,
    ownedAugs,
    overhead,
    { moneyRate, joinTime, bladeburnerRepRate },
  );
  if (augs.length === 0) return null;

  const repReq = computeRepReq(augs, staticData);
  const repRate = computeRepRate(
    faction,
    factionWorkTypes,
    factionFavor,
    player,
    bladeburnerRepRate,
    formulas,
  );

  if (repRate === 0) return null;

  const numQueued = queuedAugmentations.length;
  const costToAug = computeAugCost(augs, staticData, numQueued);
  const treeValue = augs.reduce((s, aug) => s + augValue(aug), 0);

  const currentFavor = factionFavor[faction] ?? 0;
  const currentRep = factionRep[faction] ?? 0;

  // Path 1: Early install — existing queued augs are cheaper to install now than waiting
  if (shouldEarlyInstall(numQueued, augs.length, costToAug, liquidAssets, totalIncome)) {
    const earlyValue = queuedAugmentations.reduce((s, aug) => s + augValue(aug), 0);
    return plan(gate, queuedAugmentations.map(buyAugAction), (overhead) =>
      earlyValue > 0 ? earlyValue / (overhead + graftTime) : 0,
    );
  }

  const isGang = faction === 'Slum Snakes' && ns.gang.inGang();
  const canDonate = !isGang && currentFavor >= (staticData.favorToDonate ?? Infinity);

  // Path 2: Favor grind — softReset to reach donation threshold, then donate next cycle
  if (
    !canDonate &&
    shouldPursueFavor(
      repReq,
      costToAug,
      currentRep,
      currentFavor,
      repRate,
      totalIncome,
      liquidAssets,
      player,
      formulas,
      staticData,
      overhead,
    )
  ) {
    const { favorToDonate } = staticData;
    const pastRep = formulas.reputation.calculateFavorToRep(currentFavor);
    const totalNeededRep = formulas.reputation.calculateFavorToRep(favorToDonate);
    const repToInstall = totalNeededRep - pastRep;
    const favorGoal = factionFavorGoal(faction, repToInstall, currentRep, repRate, joinGoal, gate);
    return plan([favorGoal], [], (nextOverhead) => {
      const tFavor = favorGoal.timeToComplete();
      if (tFavor == null || treeValue === 0) return 0;
      const donationRate = formulas.reputation.donationForRep(1, player);
      const tN1 = (repReq * donationRate + costToAug) / totalIncome;
      return treeValue / (tFavor + overhead + tN1 + nextOverhead);
    });
  }

  // Path 3: Donation — faction has enough favor; buy remaining rep with money
  const donationPath = (): [Goal[], Action[]] => {
    const donationRate = formulas.reputation.donationForRep(1, player);

    // Compute time until donation assuming player also grinds rep
    const effectiveCost = (repReq - currentRep) * donationRate + costToAug - liquidAssets;
    const effectiveIncome = totalIncome + repRate * donationRate;
    const timeToGoal = Math.max(0, effectiveCost / effectiveIncome);

    const moneyToEarn = Math.ceil(timeToGoal * totalIncome);
    const targetRep = currentRep + timeToGoal * repRate;
    const moneyGoal = augMoneyGoal(liquidAssets + moneyToEarn, liquidAssets, totalIncome);
    const repGoal = factionRepGoal(faction, targetRep, currentRep, joinGoal, repRate, gate);
    return [
      [joinGoal, repGoal, moneyGoal],
      [buyRepAction(faction, repReq - currentRep), ...augs.map(buyAugAction)],
    ];
  };

  // Path 4: Normal — grind faction rep
  const normalPath = (): [Goal[], Action[]] => {
    const repGoal = factionRepGoal(faction, repReq, currentRep, joinGoal, repRate, gate);
    const moneyGoal = augMoneyGoal(costToAug, liquidAssets, totalIncome);
    return [[repGoal, moneyGoal], augs.map(buyAugAction)];
  };

  const [prereqGoals, augActions] = canDonate ? donationPath() : normalPath();
  return plan(prereqGoals, augActions, (overhead) => {
    const times = prereqGoals.map((g) => g.timeToComplete());
    if (treeValue === 0) return 0;
    return treeValue / (Math.max(...times) + overhead);
  });
};

export const getBladeburnerJoinTree = (
  playerData: PlayerData,
  inBladeburner: boolean,
  formulas: Formulas | MockFormulas,
  bitNodeMultipliers: BitNodeMultipliers | null,
  graftGoal: Goal | null = null,
) => {
  const cbGoal = combatMutexGoal(
    100,
    playerData.player,
    formulas,
    bitNodeMultipliers,
    playerData.fragmentMultipliers,
    graftGoal ? [graftGoal] : [],
  );
  return bladesJoinGoal(inBladeburner, [cbGoal]);
};

export const getBladeburnerTree = (
  staticData: SF4StaticData,
  playerData: PlayerData,
  moneyData: MoneyData,
  totalIncome: number,
  inBladeburner: boolean,
  formulas: Formulas | MockFormulas,
  bitNodeMultipliers: BitNodeMultipliers | null,
  graftGoal: Goal | null = null,
) => {
  const { player, factionRep, bladeburnerRepRate = 0 } = playerData;
  const { estimatedStockValue = 0 } = moneyData;
  const { augmentationPrices, augmentationRepReqs } = staticData.singularityData;
  const bladePrice = augmentationPrices[THE_BLADE] ?? 0;
  const bladeRepCost = augmentationRepReqs[THE_BLADE] ?? 0;
  const currentRep = factionRep?.['Bladeburners'] ?? 0;
  const joinBlades = getBladeburnerJoinTree(
    playerData,
    inBladeburner,
    formulas,
    bitNodeMultipliers,
    graftGoal,
  );
  const deps = joinBlades.isDone() ? [] : [joinBlades];
  const joinBladeFaction = factionJoinGoal('Bladeburners', player.factions, deps);
  if (bladeburnerRepRate === 0) {
    return waitGoal('Wait for rep data', 60, [joinBladeFaction]);
  }
  const repGoal = factionRepGoal(
    'Bladeburners',
    bladeRepCost,
    currentRep,
    joinBladeFaction,
    bladeburnerRepRate,
    graftGoal ? [graftGoal] : [],
  );
  const augMoney = augMoneyGoal(bladePrice, player.money + estimatedStockValue, totalIncome);
  return installGoal([repGoal, augMoney], [buyAugAction(THE_BLADE)]);
};

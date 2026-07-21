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
  NEUROFLUX,
  type Action,
  type Goal,
  type Plan,
  type CombatStat,
  bladesJoinGoal,
} from './nodes.ts';
import {
  findOptimalBatch,
  MAX_AUGS,
  computeRepReq,
  computeAugCost,
  augValueFromStats,
  shouldEarlyInstall,
  shouldPursueFavor,
  computeRepRate,
} from '../aug-select.ts';
import { MoneyData, PlayerData, StaticData } from '../data-store.ts';
import { getAugWeights } from '../aug-weights.ts';
import { getMockFormulas, MockFormulas } from '../formulas.ts';

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
  }: {
    player: Player;
    staticData: StaticData;
    money: number;
    totalIncome: number;
    karma: number;
    formulas: MockFormulas | Formulas;
    fragmentMultipliers?: Record<FragmentType, number>;
  },
) => {
  const { factions, skills, city } = player;
  const { factionRequirements, serverBackdoorRequirements } = staticData;

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

  // Combine explicit skill req with backdoor hacking req; only one goal needed.
  const hackReq = Math.max(skillReqs.hacking ?? 0, bdHackReq) || null;
  const combatReq = skillReqs.strength ?? null;

  if (hackReq != null) {
    const req = hackingRequirement(hackReq, fragmentMultipliers);
    const t = formulas
      ? skillTrainingTime(player, 'hacking', req, formulas, staticData.bitNodeMultipliers)
      : null;
    joinPrereqs.push(hackingLevelGoal(req, skills.hacking ?? 0, t));
  }
  if (combatReq != null) {
    joinPrereqs.push(
      mutexGoal(
        COMBAT_STATS.map((stat) => {
          const req = combatRequirement(combatReq, stat, fragmentMultipliers);
          const t = formulas
            ? skillTrainingTime(player, stat, req, formulas, staticData.bitNodeMultipliers)
            : null;
          return combatLevelsGoal(req, stat, skills, t, combatReq);
        }),
        `${combatReq} in combat stats`,
      ),
    );
  }
  // Some factions (e.g. Daedalus) gate on alternative skill paths, e.g.
  // (hacking >= X) OR (all combat stats >= Y), expressed via someCondition.
  const buildSkillGoal = (req: Partial<Skills>) => {
    if (req.hacking) {
      const hReq = hackingRequirement(req.hacking, fragmentMultipliers);
      const t = formulas
        ? skillTrainingTime(player, 'hacking', hReq, formulas, staticData.bitNodeMultipliers)
        : null;
      return hackingLevelGoal(hReq, skills.hacking ?? 0, t);
    }
    const cReq = Math.max(0, ...COMBAT_STATS.map((stat) => req[stat] ?? 0));
    if (cReq > 0) {
      return mutexGoal(
        COMBAT_STATS.map((stat) => {
          const statReq = combatRequirement(cReq, stat, fragmentMultipliers);
          const t = formulas
            ? skillTrainingTime(player, stat, statReq, formulas, staticData.bitNodeMultipliers)
            : null;
          return combatLevelsGoal(statReq, stat, skills, t, cReq);
        }),
        `${combatReq} in combat stats`,
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

  if (killsReq) joinPrereqs.push(killsGoal(killsReq, player.numPeopleKilled ?? 0));
  if (karmaReq) joinPrereqs.push(karmaGoal(karmaReq, karma));
  const totalMoneyTarget = moneyTarget + bdMoney;
  if (totalMoneyTarget > 0) joinPrereqs.push(moneyPrereqGoal(totalMoneyTarget, money, totalIncome));
  const [loc] = locationReqs;
  if (loc) joinPrereqs.push(locationGoal(loc, city));

  return factionJoinGoal(faction, factions, joinPrereqs);
};

export const isRepBound = (root: Goal) => {
  const unmetRepGoals = root.prerequisites('FACTION_REP').filter((g) => !g.isDone());
  if (unmetRepGoals.find((g) => g.timeToComplete() == null)) return true;
  const maxRepTime =
    unmetRepGoals.length > 0 ? Math.max(...unmetRepGoals.map((g) => g.timeToComplete() ?? 0)) : 0;
  const [amg] = root.prerequisites('AUG_MONEY');
  const moneyTime = amg != null ? amg.timeToComplete() : null;
  return moneyTime == null || moneyTime <= maxRepTime;
};

const getPurchaseOrder = (
  augs: string[],
  augmentationPrereqs: Record<string, string[]>,
  augmentationPrices: Record<string, number>,
  ownedAugs: string[],
): string[] => {
  const stillNeeds = (aug: string) => !ownedAugs.includes(aug);
  const sortedByPriceDesc = (xs: string[]) =>
    [...xs].sort((a, b) => (augmentationPrices?.[b] ?? 0) - (augmentationPrices?.[a] ?? 0));
  const nfCount = augs.filter((a) => a === NEUROFLUX).length;
  const order = new Set<string>();
  for (const aug of sortedByPriceDesc(augs.filter((a) => a !== NEUROFLUX))) {
    for (const prereq of (augmentationPrereqs?.[aug] ?? []).filter(stillNeeds).reverse())
      order.add(prereq);
    order.add(aug);
  }
  // Neuroflux goes last (cheap, always available) and may appear multiple times
  return [...order, ...Array(nfCount).fill(NEUROFLUX)].slice(0, MAX_AUGS);
};

/**
 * Build the complete goal chain for one candidate faction plan.
 * Returns null if findOptimalBatch finds nothing worth pursuing.
 */
interface FactionGoalTreeProps {
  player: Player;
  staticData: StaticData;
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
  }: FactionGoalTreeProps,
): Plan | null => {
  const { augmentationPrices, augmentationPrereqs, augmentationStats, factionWorkTypes } =
    staticData;
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
  });
  const joinTime = joinGoal.timeToComplete() ?? 0;

  const { batch } = findOptimalBatch(
    faction,
    staticData,
    player,
    formulas,
    factionRep,
    ownedAugs,
    overhead,
    { moneyRate, joinTime },
  );
  if (batch.length === 0) return null;

  const augs = getPurchaseOrder(batch, augmentationPrereqs, augmentationPrices, ownedAugs);
  const repReq = computeRepReq(augs, staticData);
  const repRate = computeRepRate(
    faction,
    factionWorkTypes,
    factionRep,
    staticData.factionFavor,
    player,
    staticData.resetInfo.lastAugReset,
    formulas,
  );

  const numQueued = queuedAugmentations.length;
  const costToAug = computeAugCost(augs, staticData, numQueued);
  const treeValue = augs.reduce((s, aug) => s + augValue(aug), 0);

  const currentFavor = staticData.factionFavor?.[faction] ?? 0;
  const currentRep = factionRep[faction] ?? 0;

  // Path 1: Early install — existing queued augs are cheaper to install now than waiting
  if (shouldEarlyInstall(numQueued, augs.length, costToAug, liquidAssets, totalIncome)) {
    const earlyValue = queuedAugmentations.reduce((s, aug) => s + augValue(aug), 0);
    return plan([], queuedAugmentations.map(buyAugAction), (overhead) =>
      earlyValue > 0 ? earlyValue / overhead : 0,
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
    const favorGoal = factionFavorGoal(faction, repToInstall, currentRep, repRate, joinGoal);
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
    const donationRate = formulas?.reputation?.donationForRep(1, player) ?? Infinity;
    const donationCost = Math.max(0, repReq - currentRep) * donationRate;
    const moneyGoal = augMoneyGoal(costToAug + donationCost, liquidAssets, totalIncome);
    return [
      [joinGoal, moneyGoal],
      [buyRepAction(faction, repReq - currentRep), ...augs.map(buyAugAction)],
    ];
  };

  // Path 4: Normal — grind faction rep
  const normalPath = (): [Goal[], Action[]] => {
    const repGoal = factionRepGoal(faction, repReq, currentRep, joinGoal, repRate);
    const moneyGoal = augMoneyGoal(costToAug, liquidAssets, totalIncome);
    return [[repGoal, moneyGoal], augs.map(buyAugAction)];
  };

  const [prereqGoals, augActions] = canDonate ? donationPath() : normalPath();
  return plan(prereqGoals, augActions, (overhead) => {
    const times = prereqGoals.map((g) => g.timeToComplete());
    if (times.some((t) => t == null) || treeValue === 0) return 0;
    return treeValue / (Math.max(...(times as number[])) + overhead);
  });
};

export const getBladeburnerTree = (
  staticData: StaticData,
  playerData: PlayerData,
  moneyData: MoneyData,
  totalIncome: number,
  inBladeburner: boolean,
) => {
  const { player, factionRep, fragmentMultipliers } = playerData;
  const { estimatedStockValue = 0 } = moneyData;
  const THE_BLADE = "The Blade's Simulacrum";
  const bladePrice = staticData.augmentationPrices?.[THE_BLADE] ?? 0;
  const bladeRepCost = staticData.augmentationRepReqs?.[THE_BLADE] ?? 0;
  const currentRep = factionRep?.['Bladeburners'] ?? 0;
  const cbGoals = COMBAT_STATS.map((stat) =>
    combatLevelsGoal(
      combatRequirement(100, stat, fragmentMultipliers),
      stat,
      player.skills,
      null,
      100,
    ),
  );
  const joinBlades = bladesJoinGoal(inBladeburner, [mutexGoal(cbGoals, '100 in combat stats')]);
  const joinBladeFaction = factionJoinGoal('Bladeburners', player.factions, [joinBlades]);
  const repGoal = factionRepGoal('Bladeburners', bladeRepCost, currentRep, joinBladeFaction);
  const augMoney = augMoneyGoal(bladePrice, player.money + estimatedStockValue, totalIncome);
  return installGoal([repGoal, augMoney], [buyAugAction(THE_BLADE)]);
};

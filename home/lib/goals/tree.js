import {
  factionRepGoal,
  augMoneyGoal,
  augmentationGoal,
  neurofluxGoal,
  installGoal,
  factionJoinGoal,
  hackingLevelGoal,
  combatLevelsGoal,
  killsGoal,
  karmaGoal,
  moneyPrereqGoal,
  locationGoal,
  factionFavorGoal,
  buyRepGoal,
  COMBAT_STATS,
  NEUROFLUX,
} from './nodes.js';
import {
  findOptimalBatch,
  MAX_AUGS,
  computeRepReq,
  computeAugCost,
  augValueFromStats,
  shouldEarlyInstall,
  shouldPursueFavor,
  computeResetOverhead,
} from '../aug-select.js';

// Port program costs in purchase order; used to estimate backdoor access cost.
// TODO: Exclude programs the player already owns; consider fetching costs via ns.
const PORT_PROGRAM_COSTS = [500e3, 1500e3, 5e6, 30e6, 250e6];
const EXP_PER_SECOND = 10;

/**
 * @param {number} requirement
 * @param {number} currentLevel
 * @param {string} stat
 * @param {string[]} installedAugs
 * @param {Record<string,any>|undefined} augmentationStats
 * @param {any} formulas
 * @returns {number|null}
 */
const skillTrainingTime = (
  requirement,
  currentLevel,
  stat,
  installedAugs,
  augmentationStats,
  formulas,
) => {
  if (!formulas) return null;
  let levelMult = 1,
    expMult = 1;
  for (const aug of installedAugs) {
    const s = augmentationStats?.[aug];
    if (s?.[stat] != null) levelMult *= s[stat];
    if (s?.[`${stat}_exp`] != null) expMult *= s[`${stat}_exp`];
  }
  const currentExp = formulas.skills.calculateExp(currentLevel ?? 1, levelMult);
  const expReq = formulas.skills.calculateExp(requirement, levelMult);
  return Math.max(0, expReq - currentExp) / expMult / EXP_PER_SECOND;
};

/**
 * Build the join prereq subtree for a faction.
 * Returns early (already-joined short-circuit) when player is already a member.
 * @param {string} faction
 * @param {{
 *   player: Player,
 *   staticData: any,
 *   money: number,
 *   referenceIncome: number,
 *   karma: number,
 *   formulas?: any,
 * }} data
 * @returns {{ joinPrereqs: Goal[], joinGoal: import('./nodes.js').Goal }}
 */
export const buildJoinSubtree = (
  faction,
  { player, staticData, money, referenceIncome, karma, formulas = null },
) => {
  const { factions, skills, location } = player;
  const {
    factionRequirements,
    installedAugmentations,
    augmentationStats,
    serverBackdoorRequirements,
  } = staticData;

  if (factions.includes(faction)) {
    return {
      joinPrereqs: [],
      joinGoal: factionJoinGoal(faction, factions, []),
    };
  }

  const joinPrereqs = [];
  const requirements = factionRequirements?.[faction] ?? [];
  const skillReqs = Object.assign(
    {},
    ...requirements.filter((r) => r.type === 'skills').map((r) => r.skills),
  );
  const karmaReq = requirements.find((r) => r.type === 'karma')?.karma ?? 0;
  const killsReq =
    requirements.find((r) => r.type === 'numPeopleKilled')?.numPeopleKilled ??
    0;
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
    const serverReq = serverBackdoorRequirements.find(
      (s) => s.hostname === bdReq.server,
    );
    if (serverReq) {
      bdHackReq = serverReq.requiredHackingLevel;
      bdMoney = PORT_PROGRAM_COSTS.filter(
        (_, i) => i < serverReq.numPortsRequired,
      ).reduce((a, b) => a + b, 0);
    }
  }

  // Combine explicit skill req with backdoor hacking req; only one goal needed.
  const hackReq = Math.max(skillReqs.hacking ?? 0, bdHackReq) || null;
  const combatReq = skillReqs.strength ?? null;

  if (hackReq != null) {
    const t = skillTrainingTime(
      hackReq,
      skills.hacking ?? 1,
      'hacking',
      installedAugmentations,
      augmentationStats,
      formulas,
    );
    joinPrereqs.push(hackingLevelGoal(hackReq, skills.hacking ?? 0, t));
  }
  if (combatReq != null) {
    const times = formulas
      ? COMBAT_STATS.map(
          (stat) =>
            skillTrainingTime(
              combatReq,
              skills[stat] ?? 1,
              stat,
              installedAugmentations,
              augmentationStats,
              formulas,
            ) ?? 0,
        )
      : null;
    const t = times ? Math.max(...times) : null;
    joinPrereqs.push(combatLevelsGoal(combatReq, skills, t));
  }
  if (killsReq)
    joinPrereqs.push(killsGoal(killsReq, player.numPeopleKilled ?? 0));
  if (karmaReq) joinPrereqs.push(karmaGoal(karmaReq, karma));
  const totalMoneyTarget = moneyTarget + bdMoney;
  if (totalMoneyTarget > 0)
    joinPrereqs.push(moneyPrereqGoal(totalMoneyTarget, money, referenceIncome));
  const [loc] = locationReqs;
  if (loc) joinPrereqs.push(locationGoal(loc, location));

  const joinGoal = factionJoinGoal(faction, factions, joinPrereqs);
  return { joinPrereqs, joinGoal };
};

/** @param {import('./nodes.js').Goal[]} goals @returns {boolean} */
export const isRepBound = (goals) => {
  const unmetRepGoals = goals.filter(
    (g) => g.type === 'FACTION_REP' && !g.isDone(),
  );
  if (unmetRepGoals.find((g) => g.timeToComplete() == null)) return true;
  const maxRepTime =
    unmetRepGoals.length > 0
      ? Math.max(...unmetRepGoals.map((g) => g.timeToComplete() ?? 0))
      : 0;
  const amg = goals.find((g) => g.type === 'AUG_MONEY');
  const moneyTime = amg != null ? amg.timeToComplete() : null;
  return moneyTime == null || moneyTime <= maxRepTime;
};

/**
 * Build the complete goal chain for one candidate faction plan.
 * Returns null if findOptimalBatch finds nothing worth pursuing.
 * @param {string} faction
 * @param {{
 *   player: Player,
 *   staticData: ReturnType<import('../data-store.js').getStaticData>,
 *   factionRep: Record<string, number>,
 *   purchasedAugmentations: string[],
 *   ownedAugs: string[],
 *   money: number,
 *   estimatedStockValue: number,
 *   referenceIncome: number,
 *   formulas: ReturnType<import('../formulas.js').getMockFormulas>,
 *   karma: number,
 * }} data
 * @returns {{ goals: import('./nodes.js').Goal[], terminalGoals: import('./nodes.js').Goal[], value: number, utility: (overhead: number) => number } | null}
 */
export const buildFactionGoalTree = (
  faction,
  {
    player,
    staticData,
    factionRep,
    purchasedAugmentations,
    ownedAugs,
    money,
    estimatedStockValue = 0,
    referenceIncome,
    formulas,
    karma,
  },
) => {
  const { augmentationPrices, augmentationPrereqs, augmentationStats } =
    staticData;
  const augValue = (/** @type {string} */ aug) =>
    augValueFromStats(aug, augmentationStats);

  const moneyRate = referenceIncome || Infinity;
  const liquidAssets = money + estimatedStockValue;

  const { joinPrereqs, joinGoal } = buildJoinSubtree(faction, {
    player,
    staticData,
    money,
    referenceIncome,
    karma,
    formulas,
  });
  const joinTime = joinGoal.timeToComplete() ?? 0;

  const { batch } = findOptimalBatch(
    faction,
    staticData,
    player,
    formulas,
    factionRep,
    ownedAugs,
    { moneyRate, joinTime },
  );
  if (batch.length === 0) return null;

  const stillNeeds = (/** @type {string} */ aug) => !ownedAugs.includes(aug);
  const sortedByPriceDesc = (/** @type {string[]} */ augs) =>
    [...augs].sort(
      (a, b) => (augmentationPrices?.[b] ?? 0) - (augmentationPrices?.[a] ?? 0),
    );

  const getPurchaseOrder = (/** @type {string[]} */ augs) => {
    const nfCount = augs.filter((a) => a === NEUROFLUX).length;
    const order = new Set(/** @type {string[]} */ ([]));
    for (const aug of sortedByPriceDesc(augs.filter((a) => a !== NEUROFLUX))) {
      const prereqs = (augmentationPrereqs?.[aug] ?? [])
        .filter(stillNeeds)
        .reverse();
      for (const prereq of prereqs) order.add(prereq);
      order.add(aug);
    }
    // Neuroflux goes last (cheap, always available) and may appear multiple times
    return [...order, ...Array(nfCount).fill(NEUROFLUX)].slice(0, MAX_AUGS);
  };

  const augs = getPurchaseOrder(batch);
  const repReq = computeRepReq(augs, staticData);
  const repRate =
    formulas?.work.factionGains(
      player,
      'hacking',
      staticData.factionFavor?.[faction],
    )?.reputation * 5;

  const installedSet = new Set(staticData.installedAugmentations);
  const numQueued = purchasedAugmentations.filter(
    (aug) => !installedSet.has(aug),
  ).length;
  const costToAug = computeAugCost(augs, staticData, numQueued);
  const treeValue = augs.reduce((s, aug) => s + augValue(aug), 0);

  const currentFavor = staticData.factionFavor?.[faction] ?? 0;
  const currentRep = factionRep[faction] ?? 0;

  // Path 1: Early install — existing queued augs are cheaper to install now than waiting
  if (
    shouldEarlyInstall(
      numQueued,
      augs.length,
      costToAug,
      liquidAssets,
      referenceIncome,
    )
  ) {
    const queuedAugs = purchasedAugmentations.filter(
      (aug) => !installedSet.has(aug),
    );
    const queuedAugGoals = queuedAugs.map((aug) =>
      augmentationGoal(aug, faction, purchasedAugmentations, [], augValue(aug)),
    );
    const earlyInstall = installGoal(queuedAugGoals);
    const earlyValue = earlyInstall.value;
    return {
      goals: [...joinPrereqs, joinGoal, ...queuedAugGoals, earlyInstall],
      terminalGoals: [earlyInstall],
      value: earlyValue,
      utility(overhead) {
        const t = earlyInstall.timeToComplete();
        return t != null && earlyValue > 0 ? earlyValue / (t + overhead) : 0;
      },
    };
  }

  const canDonate = currentFavor >= (staticData.favorToDonate ?? Infinity);

  // Path 2: Favor grind — softReset to reach donation threshold, then donate next cycle
  if (
    !canDonate &&
    shouldPursueFavor(
      faction,
      repReq,
      costToAug,
      currentRep,
      currentFavor,
      repRate,
      referenceIncome,
      liquidAssets,
      player,
      formulas,
      staticData,
    )
  ) {
    const { favorToDonate } = staticData;
    const repForFavor = formulas.reputation.calculateFavorToRep(
      favorToDonate - currentFavor,
    );
    const favorGain = staticData.factionFavorGain?.[faction] ?? 0;
    const favorGoal = factionFavorGoal(
      faction,
      repForFavor,
      currentRep,
      currentFavor,
      favorGain,
      favorToDonate,
      repRate,
      joinGoal,
    );
    const favorInstall = installGoal([favorGoal], 'Soft reset for favor');
    return {
      goals: [...joinPrereqs, joinGoal, favorGoal, favorInstall],
      terminalGoals: [favorInstall],
      value: treeValue,
      utility(overhead) {
        const tFavor = favorInstall.timeToComplete();
        if (tFavor == null || treeValue === 0) return 0;
        const donationRate = formulas.reputation.donationForRep(1, player);
        const tN1 = (repReq * donationRate + costToAug) / referenceIncome;
        return (
          treeValue /
          (tFavor + computeResetOverhead(staticData) + tN1 + overhead)
        );
      },
    };
  }

  const nfBaseOrdinal =
    purchasedAugmentations.filter((a) => a === NEUROFLUX).length + 1;
  let nfOrdinal = nfBaseOrdinal;

  // Path 3: Donation — faction has enough favor; buy remaining rep with money
  // Path 4: Normal — grind faction rep
  // Both paths share augGoals construction and utility; only rep/money goal types differ.
  let repGoal, moneyGoal;
  if (canDonate) {
    const donationRate =
      formulas?.reputation?.donationForRep(1, player) ?? Infinity;
    const donationCost = Math.max(0, repReq - currentRep) * donationRate;
    moneyGoal = augMoneyGoal(
      costToAug + donationCost,
      liquidAssets,
      referenceIncome,
    );
    repGoal = buyRepGoal(faction, repReq, currentRep, [moneyGoal]);
  } else {
    repGoal = factionRepGoal(faction, repReq, currentRep, joinGoal, repRate);
    moneyGoal = augMoneyGoal(costToAug, liquidAssets, referenceIncome);
  }

  const augGoals = augs.map((aug) =>
    aug === NEUROFLUX
      ? neurofluxGoal(
          nfOrdinal++,
          faction,
          purchasedAugmentations,
          [repGoal, moneyGoal],
          augValue(aug),
        )
      : augmentationGoal(
          aug,
          faction,
          purchasedAugmentations,
          [repGoal, moneyGoal],
          augValue(aug),
        ),
  );
  const prereqGoals = canDonate ? [moneyGoal, repGoal] : [repGoal, moneyGoal];
  return {
    goals: [...joinPrereqs, joinGoal, ...prereqGoals, ...augGoals],
    terminalGoals: augGoals,
    value: treeValue,
    utility(overhead) {
      const times = augGoals.map((g) => g.timeToComplete());
      if (times.some((t) => t == null) || treeValue === 0) return 0;
      return (
        treeValue / (Math.max(.../** @type {number[]} */ (times)) + overhead)
      );
    },
  };
};

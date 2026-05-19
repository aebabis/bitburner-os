import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { augMoneyGoal, factionJoinGoal, factionRepGoal, karmaGoal } from '../home/lib/goals/nodes.js';
import { isRepBound, buildFactionGoalTree } from '../home/lib/goals/tree.js';
import { augmentationGoal } from '../home/lib/goals/nodes.js';

describe('Goal node factories', () => {
  describe('augMoneyGoal', () => {
    it.skip('isDone() is true when money >= cost');
    it.skip('ownTime() is null when referenceIncome is 0');
  });

  describe('factionRepGoal', () => {
    it.skip('ownTime() is null when rate is 0');
    it.skip('ownTime() is 0 when rep is already met');
  });

  describe('karmaGoal', () => {
    it.skip('isDone() is true when karma <= karmaRequired');
  });
});

describe('timeToComplete', () => {
  it('returns 0 when goal is already done', () => {
    const done = augmentationGoal('TestAug', 'TestFaction', ['TestAug'], []);
    assert.equal(done.timeToComplete(), 0);
  });

  it('returns null when any dep has null ownTime', () => {
    // factionRepGoal with rate=0 has null ownTime
    const joinGoal = factionJoinGoal('F', ['F']);
    const rep = factionRepGoal('F', 1000, {}, joinGoal, {}, {});
    const aug = augmentationGoal('A', 'F', [], [rep]);
    assert.equal(aug.timeToComplete(), null);
  });

  it('sums depsMax + ownTime for a two-goal chain', () => {
    // rep: 100 rep at 1/s → 100s; aug: 0 own time → total 100s
    const joinGoal = factionJoinGoal('F', ['F']);
    const rep = factionRepGoal('F', 100, {}, joinGoal, { F: 1 }, {});
    const aug = augmentationGoal('A', 'F', [], [rep]);
    assert.equal(aug.timeToComplete(), 100);
  });

  it('returns the max across parallel deps', () => {
    // rep needs 200s, money needs 50s → aug waits for rep (200s)
    const joinGoal = factionJoinGoal('F', ['F']);
    const rep = factionRepGoal('F', 200, {}, joinGoal, { F: 1 }, {});
    const money = augMoneyGoal(50, 0, 1);
    const aug = augmentationGoal('A', 'F', [], [rep, money]);
    assert.equal(aug.timeToComplete(), 200);
  });
});

describe('buildFactionGoalTree', () => {
  it.skip('returns null when batch is empty');
  it('price multiplier starts at 1.9^numQueued not 1.9^numOwned (regression)', () => {
    const AUG_PRICE = 1_000_000;
    // money = 2×AUG_PRICE covers the correct cost (1.9×) but not the buggy cost (1.9²×),
    // so moneyGoal.isDone() distinguishes the two. It also keeps money >= resetCost so
    // the early-install path doesn't trigger, letting us inspect the moneyGoal directly.
    const tree = buildFactionGoalTree('TestFaction', {
      player: { factions: ['TestFaction'], skills: {}, location: 'Sector-12' },
      staticData: {
        factionRequirements: {},
        augmentationRepReqs: { TargetAug: 0 },
        augmentationPrices: { TargetAug: AUG_PRICE },
        augmentationPrereqs: {},
        ownedAugmentations: ['InstalledAug'],     // 1 installed
      },
      factionRep: { TestFaction: 0 },
      purchasedAugmentations: ['InstalledAug', 'QueuedAug'],  // 1 installed + 1 queued
      ownedAugs: ['InstalledAug', 'QueuedAug'],
      money: AUG_PRICE * 2,
      referenceIncome: 1,
      activeRepRate: {},
      passiveRepRate: {},
      formulas: null,
      karma: 0,
      augsOverride: ['TargetAug'],
    });

    const moneyGoal = tree.goals.find(g => g.type === 'AUG_MONEY');
    // correct: requirement = 1.9^1 × price = 1.9M ≤ money (2M) → isDone
    // bug:     requirement = 1.9^2 × price = 3.61M > money (2M) → not done
    assert.ok(moneyGoal.isDone(), `expected isDone but requirement was ${moneyGoal.requirement}`);
  });
  it.skip('augsOverride skips findOptimalBatch');
  it.skip('join prereqs appear as deps of the join goal');
  it.skip('rep goal requirement equals max rep requirement across batch');
});

describe('isRepBound', () => {
  // Helper: a join goal that's already satisfied (player is in the faction)
  const joinGoal = factionJoinGoal('TestFaction', ['TestFaction']);

  it('returns true when rep rate is unknown (null ownTime on rep goal)', () => {
    // rate=0 → ownTime() returns null → timeToComplete returns null
    const repGoal = factionRepGoal('TestFaction', 1000, {}, joinGoal, {}, {});
    const moneyGoal = augMoneyGoal(1000, 0, 1);
    assert.equal(isRepBound([repGoal, moneyGoal]), true);
  });

  it('returns true when rep time >= money time', () => {
    // rep: 1000 rep needed at 1/s → 1000s
    // money: $1000 needed at $2/s → 500s
    const repGoal = factionRepGoal('TestFaction', 1000, {}, joinGoal, { TestFaction: 1 }, {});
    const moneyGoal = augMoneyGoal(1000, 0, 2);
    assert.equal(isRepBound([repGoal, moneyGoal]), true);
  });

  it('returns false when money time > rep time', () => {
    // rep: 500 rep needed at 1/s → 500s
    // money: $1000 needed at $0.5/s → 2000s
    const repGoal = factionRepGoal('TestFaction', 500, {}, joinGoal, { TestFaction: 1 }, {});
    const moneyGoal = augMoneyGoal(1000, 0, 0.5);
    assert.equal(isRepBound([repGoal, moneyGoal]), false);
  });
});

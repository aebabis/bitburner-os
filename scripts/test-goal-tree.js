import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { augMoneyGoal, factionJoinGoal, factionRepGoal, karmaGoal } from '../home/lib/goals/nodes.js';
import { timeToComplete, isRepBound, buildFactionGoalTree } from '../home/lib/goals/tree.js';

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
  it.skip('returns 0 when goal is already done');
  it.skip('returns null when any dep has null ownTime');
  it.skip('sums depsMax + ownTime for a two-goal chain');
  it.skip('returns the max across parallel deps');
});

describe('buildFactionGoalTree', () => {
  it.skip('returns null when batch is empty');
  it('price multiplier starts at 1.9^numQueued not 1.9^numOwned (regression)', () => {
    const AUG_PRICE = 1_000_000;
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
      money: 0,
      referenceIncome: 1,
      activeRepRate: {},
      passiveRepRate: {},
      formulas: null,
      karma: 0,
      augsOverride: ['TargetAug'],
    });

    const moneyGoal = tree.goals.find(g => g.type === 'AUG_MONEY');
    // 1 queued aug → multiplier = 1.9^1; bug used purchasedAugmentations.length = 2 → 1.9^2
    assert.equal(moneyGoal.requirement, AUG_PRICE * 1.9);
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

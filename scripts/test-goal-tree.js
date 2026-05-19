import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { augMoneyGoal, factionJoinGoal, factionRepGoal, karmaGoal } from '../home/lib/goals/nodes.js';
import { isRepBound, buildFactionGoalTree } from '../home/lib/goals/tree.js';
import { augmentationGoal } from '../home/lib/goals/nodes.js';

describe('Goal node factories', () => {
  describe('augMoneyGoal', () => {
    it('isDone() is true when money >= cost', () => {
      assert.equal(augMoneyGoal(1000, 1000, 1).isDone(), true);
    });

    it('ownTime() is null when referenceIncome is 0', () => {
      assert.equal(augMoneyGoal(1000, 0, 0).ownTime(), null);
    });
  });

  describe('factionRepGoal', () => {
    const join = factionJoinGoal('F', ['F']);

    it('ownTime() is null when rate is 0', () => {
      assert.equal(factionRepGoal('F', 1000, {}, join, {}, {}).ownTime(), null);
    });

    it('ownTime() is 0 when rep is already met', () => {
      assert.equal(factionRepGoal('F', 1000, { F: 1000 }, join, { F: 1 }, {}).ownTime(), 0);
    });
  });

  describe('karmaGoal', () => {
    it('isDone() is true when karma <= karmaRequired', () => {
      // karma is negative in Bitburner; -100 satisfies a -54 requirement
      assert.equal(karmaGoal(-54, -100).isDone(), true);
      assert.equal(karmaGoal(-54, -20).isDone(), false);
    });
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
  it('returns null when batch is empty', () => {
    // All augs already owned → findOptimalBatch returns [] → buildFactionGoalTree returns null.
    // activeRepRate provides repRate so formulas.work.factionGains is never called.
    const tree = buildFactionGoalTree('TestFaction', {
      player: { factions: ['TestFaction'], skills: {}, location: 'Sector-12' },
      staticData: {
        factionRequirements: { TestFaction: [] },
        factionAugmentations: { TestFaction: ['OwnedAug'] },
        augmentationRepReqs: { OwnedAug: 0 },
        augmentationPrices: { OwnedAug: 0 },
        augmentationPrereqs: {},
        factionFavor: {},
        ownedAugmentations: ['OwnedAug'],
      },
      factionRep: {},
      purchasedAugmentations: ['OwnedAug'],
      ownedAugs: ['OwnedAug'],
      money: 0,
      referenceIncome: 0,
      activeRepRate: { TestFaction: 1 },
      passiveRepRate: {},
      formulas: null,
      karma: 0,
    });
    assert.equal(tree, null);
  });
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
  it('augsOverride skips findOptimalBatch', () => {
    // SpecificAug is not in factionAugmentations — findOptimalBatch would never select it.
    // augsOverride forces the batch to contain it, proving findOptimalBatch was bypassed.
    const tree = buildFactionGoalTree('TestFaction', {
      player: { factions: ['TestFaction'], skills: {}, location: 'Sector-12' },
      staticData: {
        factionRequirements: {},
        factionAugmentations: { TestFaction: ['OtherAug'] },
        augmentationRepReqs: { SpecificAug: 0 },
        augmentationPrices: { SpecificAug: 0 },
        augmentationPrereqs: {},
        ownedAugmentations: [],
      },
      factionRep: {},
      purchasedAugmentations: [],
      ownedAugs: [],
      money: 0,
      referenceIncome: 0,
      activeRepRate: {},
      passiveRepRate: {},
      formulas: null,
      karma: 0,
      augsOverride: ['SpecificAug'],
    });
    const augGoals = tree.goals.filter(g => g.type === 'AUGMENTATION');
    assert.deepEqual(augGoals.map(g => g.desc), ['SpecificAug']);
  });
  it('join prereqs appear as deps of the join goal', () => {
    const tree = buildFactionGoalTree('TestFaction', {
      player: { factions: [], skills: { hacking: 1 }, location: 'Sector-12' },
      staticData: {
        factionRequirements: { TestFaction: [{ type: 'skills', skills: { hacking: 100 } }] },
        augmentationRepReqs: { TestAug: 0 },
        augmentationPrices: { TestAug: 0 },
        augmentationPrereqs: {},
        ownedAugmentations: [],
      },
      factionRep: {},
      purchasedAugmentations: [],
      ownedAugs: [],
      money: 0,
      referenceIncome: 0,
      activeRepRate: {},
      passiveRepRate: {},
      formulas: null,
      karma: 0,
      augsOverride: ['TestAug'],
    });
    const joinGoal = tree.goals.find(g => g.type === 'FACTION_JOIN');
    assert.ok(joinGoal, 'join goal should exist');
    assert.ok(joinGoal.deps.some(d => d.type === 'HACKING_LEVEL'), 'join goal should have a HACKING_LEVEL dep');
  });
  it('rep goal requirement equals max rep requirement across batch', () => {
    const tree = buildFactionGoalTree('TestFaction', {
      player: { factions: ['TestFaction'], skills: {}, location: 'Sector-12' },
      staticData: {
        factionRequirements: {},
        augmentationRepReqs: { AugA: 10000, AugB: 25000, AugC: 5000 },
        augmentationPrices: { AugA: 0, AugB: 0, AugC: 0 },
        augmentationPrereqs: {},
        ownedAugmentations: [],
      },
      factionRep: {},
      purchasedAugmentations: [],
      ownedAugs: [],
      money: 0,
      referenceIncome: 0,
      activeRepRate: {},
      passiveRepRate: {},
      formulas: null,
      karma: 0,
      augsOverride: ['AugA', 'AugB', 'AugC'],
    });
    const repGoal = tree.goals.find(g => g.type === 'FACTION_REP');
    assert.equal(repGoal.requirement, 25000);
  });
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

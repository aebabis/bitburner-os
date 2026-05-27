import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  augMoneyGoal,
  factionJoinGoal,
  factionRepGoal,
  karmaGoal,
  augmentationGoal,
  installGoal,
} from '../home/lib/goals/nodes.js';
import { isRepBound, buildFactionGoalTree } from '../home/lib/goals/tree.js';
import { computeRepReq, computeAugCost } from '../home/lib/aug-select.js';
import { getMockFormulas } from '../home/lib/formulas.js';

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
      assert.equal(factionRepGoal('F', 1000, {}, join, 0).ownTime(), null);
    });

    it('ownTime() is 0 when rep is already met', () => {
      assert.equal(
        factionRepGoal('F', 1000, { F: 1000 }, join, 1).ownTime(),
        0,
      );
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

describe('value', () => {
  it('augmentationGoal carries its value', () => {
    const aug = augmentationGoal('A', 'F', [], [], 3.5);
    assert.equal(aug.value, 3.5);
  });

  it('augmentationGoal defaults to 0 when value omitted', () => {
    const aug = augmentationGoal('A', 'F', [], []);
    assert.equal(aug.value, 0);
  });

  it('installGoal sums deps values', () => {
    const a = augmentationGoal('A', 'F', [], [], 2.0);
    const b = augmentationGoal('B', 'F', [], [], 1.5);
    const install = installGoal([a, b]);
    assert.equal(install.value, 3.5);
  });

  it('prerequisite goals (rep, money, join) have value 0', () => {
    const join = factionJoinGoal('F', ['F']);
    const rep = factionRepGoal('F', 1000, {}, join, 1);
    const money = augMoneyGoal(1e6, 0, 1);
    assert.equal(join.value, 0);
    assert.equal(rep.value, 0);
    assert.equal(money.value, 0);
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
    const rep = factionRepGoal('F', 1000, {}, joinGoal, 0);
    const aug = augmentationGoal('A', 'F', [], [rep]);
    assert.equal(aug.timeToComplete(), null);
  });

  it('sums depsMax + ownTime for a two-goal chain', () => {
    // rep: 100 rep at 1/s → 100s; aug: 0 own time → total 100s
    const joinGoal = factionJoinGoal('F', ['F']);
    const rep = factionRepGoal('F', 100, {}, joinGoal, 1);
    const aug = augmentationGoal('A', 'F', [], [rep]);
    assert.equal(aug.timeToComplete(), 100);
  });

  it('returns the max across parallel deps', () => {
    // rep needs 200s, money needs 50s → aug waits for rep (200s)
    const joinGoal = factionJoinGoal('F', ['F']);
    const rep = factionRepGoal('F', 200, {}, joinGoal, 1);
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
        installedAugmentations: ['OwnedAug'],
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
        installedAugmentations: ['InstalledAug'], // 1 installed
      },
      factionRep: { TestFaction: 0 },
      purchasedAugmentations: ['InstalledAug', 'QueuedAug'], // 1 installed + 1 queued
      ownedAugs: ['InstalledAug', 'QueuedAug'],
      money: AUG_PRICE * 2,
      referenceIncome: 1,
      activeRepRate: {},
      passiveRepRate: {},
      formulas: null,
      karma: 0,
      augsOverride: ['TargetAug'],
    });

    const moneyGoal = tree.goals.find((g) => g.type === 'AUG_MONEY');
    // correct: requirement = 1.9^1 × price = 1.9M ≤ money (2M) → isDone
    // bug:     requirement = 1.9^2 × price = 3.61M > money (2M) → not done
    assert.ok(
      moneyGoal.isDone(),
      `expected isDone but requirement was ${moneyGoal.requirement}`,
    );
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
        installedAugmentations: [],
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
    const augGoals = tree.goals.filter((g) => g.type === 'AUGMENTATION');
    assert.deepEqual(
      augGoals.map((g) => g.desc),
      ['SpecificAug'],
    );
  });
  it('join prereqs appear as deps of the join goal', () => {
    const tree = buildFactionGoalTree('TestFaction', {
      player: { factions: [], skills: { hacking: 1 }, location: 'Sector-12' },
      staticData: {
        factionRequirements: {
          TestFaction: [{ type: 'skills', skills: { hacking: 100 } }],
        },
        augmentationRepReqs: { TestAug: 0 },
        augmentationPrices: { TestAug: 0 },
        augmentationPrereqs: {},
        installedAugmentations: [],
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
    const joinGoal = tree.goals.find((g) => g.type === 'FACTION_JOIN');
    assert.ok(joinGoal, 'join goal should exist');
    assert.ok(
      joinGoal.deps.some((d) => d.type === 'HACKING_LEVEL'),
      'join goal should have a HACKING_LEVEL dep',
    );
  });
  it('rep goal requirement equals max rep requirement across batch', () => {
    const tree = buildFactionGoalTree('TestFaction', {
      player: { factions: ['TestFaction'], skills: {}, location: 'Sector-12' },
      staticData: {
        factionRequirements: {},
        augmentationRepReqs: { AugA: 10000, AugB: 25000, AugC: 5000 },
        augmentationPrices: { AugA: 0, AugB: 0, AugC: 0 },
        augmentationPrereqs: {},
        installedAugmentations: [],
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
    const repGoal = tree.goals.find((g) => g.type === 'FACTION_REP');
    assert.equal(repGoal.requirement, 25000);
  });

  // Shared setup for utility/value tests: aug A with hacking:1.5 → value=(1.5-1)*10=5.0
  const valueTestData = (repRate) => ({
    player: { factions: ['F'], skills: {}, location: 'Sector-12' },
    staticData: {
      factionRequirements: {},
      augmentationRepReqs: { A: 100 },
      augmentationPrices: { A: 0 },
      augmentationPrereqs: {},
      installedAugmentations: [],
      augmentationStats: { A: { hacking: 1.5 } },
    },
    factionRep: {},
    purchasedAugmentations: [],
    ownedAugs: [],
    money: 0,
    referenceIncome: 0,
    activeRepRate: repRate > 0 ? { F: repRate } : {},
    passiveRepRate: {},
    formulas: null,
    karma: 0,
    augsOverride: ['A'],
  });

  it('tree.value equals sum of terminal aug values', () => {
    const tree = buildFactionGoalTree('F', valueTestData(1));
    assert.equal(tree.value, 5.0); // (1.5-1)*10 = 5.0
  });

  it('utility returns 0 when rep rate is unknown (null timeToComplete)', () => {
    const tree = buildFactionGoalTree('F', valueTestData(0));
    assert.equal(tree.utility(0), 0);
  });

  it('utility returns value / (eta + overhead)', () => {
    const tree = buildFactionGoalTree('F', valueTestData(1));
    // repReq=100, repRate=1 → eta=100s; value=5.0; overhead=50
    assert.equal(tree.utility(50), 5.0 / (100 + 50));
  });

  it('utility is higher for a faster plan (same value, shorter eta)', () => {
    const fast = buildFactionGoalTree('F', valueTestData(2)); // eta=50s
    const slow = buildFactionGoalTree('F', valueTestData(1)); // eta=100s
    assert.ok(fast.utility(0) > slow.utility(0));
  });
});

describe('computeRepReq', () => {
  it('returns 0 for an empty batch', () => {
    assert.equal(computeRepReq([], { augmentationRepReqs: {} }), 0);
  });

  it('returns the max rep requirement across all augs', () => {
    const staticData = { augmentationRepReqs: { A: 1000, B: 5000, C: 500 } };
    assert.equal(computeRepReq(['A', 'B', 'C'], staticData), 5000);
  });

  it('treats missing rep reqs as 0', () => {
    assert.equal(computeRepReq(['Unknown'], { augmentationRepReqs: {} }), 0);
  });
});

describe('computeAugCost', () => {
  const NF = 'NeuroFlux Governor';

  it('costs a single aug with no queue multiplier', () => {
    const staticData = { augmentationPrices: { A: 1_000_000 } };
    assert.equal(computeAugCost(['A'], staticData, 0), 1_000_000);
  });

  it('applies the 1.9^numQueued multiplier to the first aug', () => {
    const staticData = { augmentationPrices: { A: 1_000_000 } };
    assert.equal(computeAugCost(['A'], staticData, 2), 1_000_000 * 1.9 ** 2);
  });

  it('compounds the queue multiplier across multiple augs (most expensive first)', () => {
    const staticData = { augmentationPrices: { Cheap: 100, Expensive: 1000 } };
    // sorted desc: Expensive (×1.9^0), Cheap (×1.9^1)
    const expected = 1000 * 1 + 100 * 1.9;
    assert.equal(
      computeAugCost(['Cheap', 'Expensive'], staticData, 0),
      expected,
    );
  });

  it('applies the 1.14^installedNFCount base offset to NF price', () => {
    const installedNFCount = 3;
    const nfBase = 750_000;
    const staticData = {
      augmentationPrices: { [NF]: nfBase },
      resetInfo: { ownedAugs: new Map([[NF, installedNFCount]]) },
    };
    const expected = nfBase * 1.14 ** installedNFCount; // numQueued=0, first NF level offset=3
    assert.equal(computeAugCost([NF], staticData, 0), expected);
  });

  it('increments the NF level offset for each successive NF in the batch', () => {
    const nfBase = 750_000;
    const staticData = { augmentationPrices: { [NF]: nfBase } };
    // two NF, no installed, no queued: first at 1.14^0, second at 1.9 × 1.14^1
    const expected = nfBase * 1.14 ** 0 + nfBase * 1.9 * 1.14 ** 1;
    assert.equal(computeAugCost([NF, NF], staticData, 0), expected);
  });
});

describe('isRepBound', () => {
  // Helper: a join goal that's already satisfied (player is in the faction)
  const joinGoal = factionJoinGoal('TestFaction', ['TestFaction']);

  it('returns true when rep rate is unknown (null ownTime on rep goal)', () => {
    // rate=0 → ownTime() returns null → timeToComplete returns null
    const repGoal = factionRepGoal('TestFaction', 1000, {}, joinGoal, 0);
    const moneyGoal = augMoneyGoal(1000, 0, 1);
    assert.equal(isRepBound([repGoal, moneyGoal]), true);
  });

  it('returns true when rep time >= money time', () => {
    // rep: 1000 rep needed at 1/s → 1000s
    // money: $1000 needed at $2/s → 500s
    const repGoal = factionRepGoal('TestFaction', 1000, {}, joinGoal, 1);
    const moneyGoal = augMoneyGoal(1000, 0, 2);
    assert.equal(isRepBound([repGoal, moneyGoal]), true);
  });

  it('returns false when money time > rep time', () => {
    // rep: 500 rep needed at 1/s → 500s
    // money: $1000 needed at $0.5/s → 2000s
    const repGoal = factionRepGoal('TestFaction', 500, {}, joinGoal, 1);
    const moneyGoal = augMoneyGoal(1000, 0, 0.5);
    assert.equal(isRepBound([repGoal, moneyGoal]), false);
  });
});

const mockFormulas = getMockFormulas({ installedAugmentations: [] });

describe('getMockFormulas reputation', () => {
  it('calculateFavorToRep(0) is 0', () => {
    assert.equal(mockFormulas.reputation.calculateFavorToRep(0), 0);
  });

  it('calculateRepToFavor is the inverse of calculateFavorToRep', () => {
    for (const favor of [1, 10, 50, 100, 150]) {
      const rep = mockFormulas.reputation.calculateFavorToRep(favor);
      assert.equal(mockFormulas.reputation.calculateRepToFavor(rep), favor);
    }
  });

  it('donationForRep is the inverse of repFromDonation', () => {
    const rep = 100_000;
    const cost = mockFormulas.reputation.donationForRep(rep, {});
    const repBack = mockFormulas.reputation.repFromDonation(cost, {});
    assert.ok(Math.abs(repBack - rep) < 1e-6);
  });

  it('donationForRep scales with faction_rep aug mult', () => {
    const base = getMockFormulas({ installedAugmentations: [] });
    const boosted = getMockFormulas({
      installedAugmentations: ['FactionAug'],
      augmentationStats: { FactionAug: { faction_rep: 1.25 } },
    });
    const baseCost = base.reputation.donationForRep(1000, {});
    const boostedCost = boosted.reputation.donationForRep(1000, {});
    assert.ok(boostedCost < baseCost, 'aug mult should reduce donation cost');
    assert.ok(Math.abs(boostedCost - baseCost / 1.25) < 1e-6);
  });
});

describe('buildFactionGoalTree path 3 (donation)', () => {
  // canDonate = true when factionFavor >= favorToDonate
  const donationData = () => ({
    player: {
      factions: ['F'],
      skills: { hacking: 200 },
      location: 'Sector-12',
    },
    staticData: {
      factionRequirements: {},
      augmentationRepReqs: { A: 50_000 },
      augmentationPrices: { A: 1_000_000 },
      augmentationPrereqs: {},
      installedAugmentations: [],
      factionFavor: { F: 150 },
      favorToDonate: 150,
    },
    factionRep: { F: 0 },
    purchasedAugmentations: [],
    ownedAugs: [],
    money: 0,
    estimatedStockValue: 0,
    referenceIncome: 1,
    activeRepRate: { F: 1 },
    passiveRepRate: {},
    formulas: mockFormulas,
    karma: 0,
    augsOverride: ['A'],
  });

  it('produces a BUY_REP goal when faction has enough favor', () => {
    const tree = buildFactionGoalTree('F', donationData());
    assert.ok(tree, 'tree should not be null');
    const repGoal = tree.goals.find((g) => g.type === 'BUY_REP');
    assert.ok(repGoal, 'should have a BUY_REP goal');
  });

  it('money goal includes donation cost', () => {
    const tree = buildFactionGoalTree('F', donationData());
    const moneyGoal = tree.goals.find((g) => g.type === 'AUG_MONEY');
    // donationForRep(50000, player) = 50000 * 1e6 / 1 = 5e10; augCost = 1e6
    const expectedDonation = mockFormulas.reputation.donationForRep(50_000, {});
    assert.equal(moneyGoal.requirement, 1_000_000 + expectedDonation);
  });
});

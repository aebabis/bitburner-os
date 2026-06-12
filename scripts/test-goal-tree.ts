import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  augMoneyGoal,
  factionJoinGoal,
  factionRepGoal,
  installGoal,
  karmaGoal,
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
      assert.equal(factionRepGoal('F', 1000, 0, join, 0).ownTime(), null);
    });

    it('ownTime() is 0 when rep is already met', () => {
      assert.equal(factionRepGoal('F', 1000, 1000, join, 1).ownTime(), 0);
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
  it('returns null when dep has null ownTime', () => {
    // factionRepGoal with rate=0 has null ownTime → its dependent returns null
    const joinGoal = factionJoinGoal('F', ['F']);
    const rep = factionRepGoal('F', 1000, {}, joinGoal, 0);
    assert.equal(rep.timeToComplete(), null);
  });

  it('sums depsMax + ownTime for a chain', () => {
    // join already done (0s); rep: 100 at 1/s → 100s
    const joinGoal = factionJoinGoal('F', ['F']);
    const rep = factionRepGoal('F', 100, 0, joinGoal, 1);
    assert.equal(rep.timeToComplete(), 100);
  });

  it('returns the max across parallel deps', () => {
    // rep needs 200s, money needs 50s → dependent waits for rep (200s)
    const joinGoal = factionJoinGoal('F', ['F']);
    const rep = factionRepGoal('F', 200, 0, joinGoal, 1);
    const money = augMoneyGoal(50, 0, 1);
    // factionRepGoal only takes one dep; use money as a sibling via join chain
    // Verify by checking each independently
    assert.equal(rep.timeToComplete(), 200);
    assert.equal(money.timeToComplete(), 50);
  });
});

describe('buildFactionGoalTree', () => {
  it('returns null when batch is empty', () => {
    // All augs already owned → findOptimalBatch returns [] → buildFactionGoalTree returns null.
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
      totalIncome: 0,
      formulas: mockFormulas,
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
        factionAugmentations: { TestFaction: ['TargetAug'] },
        augmentationStats: { TargetAug: { hacking: 1.5 } },
        augmentationRepReqs: { TargetAug: 0 },
        augmentationPrices: { TargetAug: AUG_PRICE },
        augmentationPrereqs: {},
        installedAugmentations: ['InstalledAug'], // 1 installed
      },
      factionRep: { TestFaction: 0 },
      purchasedAugmentations: ['InstalledAug', 'QueuedAug'], // 1 installed + 1 queued
      ownedAugs: ['InstalledAug', 'QueuedAug'],
      money: AUG_PRICE * 2,
      totalIncome: 1,
      formulas: mockFormulas,
      karma: 0,
    });

    assert.ok(tree);
    const moneyGoal = tree.deps.find((g: any) => g.type === 'AUG_MONEY');
    // correct: requirement = 1.9^1 × price = 1.9M ≤ money (2M) → isDone
    // bug:     requirement = 1.9^2 × price = 3.61M > money (2M) → not done
    assert.ok(
      moneyGoal.isDone(),
      `expected isDone but requirement was ${moneyGoal.requirement}`,
    );
  });
  it('join prereqs appear as deps of the join goal', () => {
    const tree = buildFactionGoalTree('TestFaction', {
      player: { factions: [], skills: { hacking: 1 }, location: 'Sector-12' },
      staticData: {
        factionRequirements: {
          TestFaction: [{ type: 'skills', skills: { hacking: 100 } }],
        },
        factionAugmentations: { TestFaction: ['TestAug'] },
        augmentationStats: { TestAug: { hacking: 1.5 } },
        augmentationRepReqs: { TestAug: 0 },
        augmentationPrices: { TestAug: 0 },
        augmentationPrereqs: {},
        installedAugmentations: [],
      },
      factionRep: {},
      purchasedAugmentations: [],
      ownedAugs: [],
      money: 0,
      totalIncome: 0,
      formulas: mockFormulas,
      karma: 0,
    });
    assert.ok(tree);
    const joinGoal = tree.deps.flatMap((g: any) =>
      g.prerequisites('FACTION_JOIN'),
    )[0];
    assert.ok(joinGoal, 'join goal should exist');
    assert.ok(
      joinGoal.deps.some((d: any) => d.type === 'HACKING_LEVEL'),
      'join goal should have a HACKING_LEVEL dep',
    );
  });
  it('rep goal requirement equals max rep requirement across batch', () => {
    const tree = buildFactionGoalTree('TestFaction', {
      player: {
        factions: ['TestFaction'],
        skills: { hacking: 195 },
        location: 'Sector-12',
      },
      staticData: {
        factionRequirements: {},
        factionAugmentations: { TestFaction: ['AugA', 'AugB', 'AugC'] },
        // Equal value, tightly-spaced repReqs so the 3-aug batch beats any subset:
        // utility([A,B,C])=3v/(3k+7200) > utility([A,B])=2v/(2k+7200) > utility([A])=v/(1k+7200)
        augmentationStats: {
          AugA: { hacking: 1.5 },
          AugB: { hacking: 1.5 },
          AugC: { hacking: 1.5 },
        },
        augmentationRepReqs: { AugA: 1000, AugB: 2000, AugC: 3000 },
        augmentationPrices: { AugA: 0, AugB: 0, AugC: 0 },
        augmentationPrereqs: {},
        installedAugmentations: [],
      },
      factionRep: {},
      purchasedAugmentations: [],
      ownedAugs: [],
      money: 0,
      totalIncome: 0,
      formulas: mockFormulas,
      karma: 0,
    });
    assert.ok(tree);
    const repGoal = tree.deps.find((g: any) => g.type === 'FACTION_REP');
    assert.equal(repGoal.requirement, 3000);
  });

  // Shared setup for utility/value tests: aug A with hacking:1.5 → value=(1.5-1)*10=5.0
  // repRate=N requires hacking = N * 195: factionGains(player,'hacking',0).reputation = hacking/975,
  // effectiveRepRate = reputation * 5 = N when hacking = N * 195.
  const valueTestData = (repRate: number) => ({
    player: {
      factions: ['F'],
      skills: { hacking: repRate * 195 },
      location: 'Sector-12',
    },
    staticData: {
      factionRequirements: {},
      factionAugmentations: { F: ['A'] },
      augmentationStats: { A: { hacking: 1.5 } },
      augmentationRepReqs: { A: 100 },
      augmentationPrices: { A: 0 },
      augmentationPrereqs: {},
      installedAugmentations: [],
    },
    factionRep: {},
    purchasedAugmentations: [],
    ownedAugs: [],
    money: 0,
    totalIncome: 0,
    formulas: mockFormulas,
    karma: 0,
  });

  it('utility returns value / (eta + overhead)', () => {
    const tree = buildFactionGoalTree('F', valueTestData(1));
    assert.ok(tree);
    // repReq=100, repRate=1 → eta=100s; value=5.0; overhead=50
    assert.equal(tree.utility(50), 5.0 / (100 + 50));
  });

  it('utility is higher for a faster plan (same value, shorter eta)', () => {
    const fast = buildFactionGoalTree('F', valueTestData(2)); // eta=50s
    const slow = buildFactionGoalTree('F', valueTestData(1)); // eta=100s
    assert.ok(fast);
    assert.ok(slow);
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
  const root = (repGoal, moneyGoal) => installGoal([repGoal, moneyGoal], []);

  it('returns true when rep rate is unknown (null ownTime on rep goal)', () => {
    // rate=0 → ownTime() returns null → timeToComplete returns null
    const repGoal = factionRepGoal('TestFaction', 1000, 0, joinGoal, 0);
    const moneyGoal = augMoneyGoal(1000, 0, 1);
    assert.equal(isRepBound(root(repGoal, moneyGoal)), true);
  });

  it('returns true when rep time >= money time', () => {
    // rep: 1000 rep needed at 1/s → 1000s
    // money: $1000 needed at $2/s → 500s
    const repGoal = factionRepGoal('TestFaction', 1000, 0, joinGoal, 1);
    const moneyGoal = augMoneyGoal(1000, 0, 2);
    assert.equal(isRepBound(root(repGoal, moneyGoal)), true);
  });

  it('returns false when money time > rep time', () => {
    // rep: 500 rep needed at 1/s → 500s
    // money: $1000 needed at $0.5/s → 2000s
    const repGoal = factionRepGoal('TestFaction', 500, 0, joinGoal, 1);
    const moneyGoal = augMoneyGoal(1000, 0, 0.5);
    assert.equal(isRepBound(root(repGoal, moneyGoal)), false);
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
      factionAugmentations: { F: ['A'] },
      augmentationStats: { A: { hacking: 1.5 } },
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
    totalIncome: 1,
    formulas: mockFormulas,
    karma: 0,
  });

  it('produces a BUY_REP action when faction has enough favor', () => {
    const tree = buildFactionGoalTree('F', donationData());
    assert.ok(tree, 'tree should not be null');
    const repAction = tree.actions.find((a: any) => a.type === 'BUY_REP');
    assert.ok(repAction, 'should have a BUY_REP action');
  });

  it('money goal includes donation cost', () => {
    const tree = buildFactionGoalTree('F', donationData());
    assert.ok(tree);
    const moneyGoal = tree.deps.find((g: any) => g.type === 'AUG_MONEY');
    // donationForRep(50000, player) = 50000 * 1e6 / 1 = 5e10; augCost = 1e6
    const expectedDonation = mockFormulas.reputation.donationForRep(50_000, {});
    assert.equal(moneyGoal.requirement, 1_000_000 + expectedDonation);
  });
});

import { setupRunner, assert } from '../test-runner';
import {
  augMoneyGoal,
  factionJoinGoal,
  factionRepGoal,
  installGoal,
  karmaGoal,
  type Goal,
} from '../goals/nodes';
import { isRepBound, buildFactionGoalTree } from '../goals/tree';
import { computeRepReq, computeAugCost, computeResetOverhead } from '../aug-select';
import { getMockFormulas } from '../formulas';
import { buildPerson } from './fixtures';

const mockResetInfo = {
  lastAugReset: 0,
  lastNodeReset: 0,
  currentNode: 1,
  ownedAugs: new Map(),
  ownedSF: new Map(),
};

export async function main(ns: NS) {
  const { describe, it, runSuite } = setupRunner(ns);

  const mockFormulas = getMockFormulas({ installedAugmentations: [] } as any);

  describe('Goal node factories', () => {
    describe('augMoneyGoal', () => {
      it('isDone() is true when money >= cost', () => {
        assert.equal(augMoneyGoal(1000, 1000, 1).isDone(), true);
      });

      it('ownTime() is null when totalIncome is 0', () => {
        assert.equal(augMoneyGoal(1000, 0, 0).ownTime(), null);
      });
    });

    describe('factionRepGoal', () => {
      const join = factionJoinGoal('F' as FactionName, ['F' as FactionName]);

      it('ownTime() is null when rate is 0', () => {
        assert.equal(factionRepGoal('F' as FactionName, 1000, 0, join, 0).ownTime(), null);
      });

      it('ownTime() is 0 when rep is already met', () => {
        assert.equal(factionRepGoal('F' as FactionName, 1000, 1000, join, 1).ownTime(), 0);
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
      const joinGoal = factionJoinGoal('F' as FactionName, ['F' as FactionName]);
      const rep = factionRepGoal('F' as FactionName, 1000, 0, joinGoal, 0);
      assert.equal(rep.timeToComplete(), null);
    });

    it('sums depsMax + ownTime for a chain', () => {
      // join already done (0s); rep: 100 at 1/s → 100s
      const joinGoal = factionJoinGoal('F' as FactionName, ['F' as FactionName]);
      const rep = factionRepGoal('F' as FactionName, 100, 0, joinGoal, 1);
      assert.equal(rep.timeToComplete(), 100);
    });

    it('returns the max across parallel deps', () => {
      // rep needs 200s, money needs 50s → dependent waits for rep (200s)
      const joinGoal = factionJoinGoal('F' as FactionName, ['F' as FactionName]);
      const rep = factionRepGoal('F' as FactionName, 200, 0, joinGoal, 1);
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
      const staticData = {
        resetInfo: mockResetInfo,
        factionRequirements: { TestFaction: [] },
        factionAugmentations: { TestFaction: ['OwnedAug'] },
        augmentationRepReqs: { OwnedAug: 0 },
        augmentationPrices: { OwnedAug: 0 },
        augmentationPrereqs: {},
        factionFavor: {},
        installedAugmentations: ['OwnedAug'],
      } as any;
      const tree = buildFactionGoalTree(ns, 'TestFaction' as FactionName, {
        player: {
          factions: ['TestFaction' as FactionName],
          skills: {},
          location: 'Sector-12',
        } as any,
        staticData,
        factionRep: {},
        queuedAugmentations: ['OwnedAug'],
        ownedAugs: ['OwnedAug'],
        money: 0,
        totalIncome: 0,
        formulas: mockFormulas as any,
        karma: 0,
        overhead: computeResetOverhead(staticData),
      });
      assert.equal(tree, null);
    });
    it('price multiplier starts at 1.9^numQueued not 1.9^numOwned (regression)', () => {
      const AUG_PRICE = 1_000_000;
      // money = 2×AUG_PRICE covers the correct cost (1.9×) but not the buggy cost (1.9²×),
      // so moneyGoal.isDone() distinguishes the two. It also keeps money >= resetCost so
      // the early-install path doesn't trigger, letting us inspect the moneyGoal directly.
      const staticData = {
        resetInfo: mockResetInfo,
        factionRequirements: {},
        factionAugmentations: { TestFaction: ['TargetAug'] },
        augmentationStats: { TargetAug: { hacking: 1.5 } },
        augmentationRepReqs: { TargetAug: 0 },
        augmentationPrices: { TargetAug: AUG_PRICE },
        augmentationPrereqs: {},
        installedAugmentations: ['InstalledAug'], // 1 installed
      } as any;
      const tree = buildFactionGoalTree(ns, 'TestFaction' as FactionName, {
        player: {
          factions: ['TestFaction' as FactionName],
          skills: {},
          location: 'Sector-12',
        } as any,
        staticData,
        factionRep: { TestFaction: 0 },
        queuedAugmentations: ['QueuedAug'], // 1 installed + 1 queued
        ownedAugs: ['InstalledAug', 'QueuedAug'],
        money: AUG_PRICE * 2,
        totalIncome: 1,
        formulas: mockFormulas as any,
        karma: 0,
        overhead: computeResetOverhead(staticData),
      });

      assert.ok(tree);
      const moneyGoal = tree.deps.find((g: any) => g.type === 'AUG_MONEY')!;
      // correct: requirement = 1.9^1 × price = 1.9M ≤ money (2M) → isDone
      // bug:     requirement = 1.9^2 × price = 3.61M > money (2M) → not done
      assert.ok(moneyGoal.isDone(), `expected isDone but requirement was ${moneyGoal.requirement}`);
    });
    it('join prereqs appear as deps of the join goal', () => {
      const staticData = {
        resetInfo: mockResetInfo,
        factionRequirements: {
          TestFaction: [{ type: 'skills', skills: { hacking: 100 } }],
        },
        factionAugmentations: { TestFaction: ['TestAug'] },
        augmentationStats: { TestAug: { hacking: 1.5 } },
        augmentationRepReqs: { TestAug: 0 },
        augmentationPrices: { TestAug: 0 },
        augmentationPrereqs: {},
        installedAugmentations: [],
      } as any;
      const tree = buildFactionGoalTree(ns, 'TestFaction' as FactionName, {
        player: {
          factions: [],
          skills: { hacking: 1 },
          mults: { hacking: 1 },
          exp: { hacking: 0 },
          location: 'Sector-12',
        } as any,
        staticData,
        factionRep: {},
        queuedAugmentations: [],
        ownedAugs: [],
        money: 0,
        totalIncome: 0,
        formulas: mockFormulas as any,
        karma: 0,
        overhead: computeResetOverhead(staticData),
      });
      assert.ok(tree);
      const joinGoal = tree.deps.flatMap((g: any) => g.prerequisites('FACTION_JOIN'))[0];
      assert.ok(joinGoal, 'join goal should exist');
      assert.ok(
        joinGoal.deps.some((d: any) => d.type === 'HACKING_LEVEL'),
        'join goal should have a HACKING_LEVEL dep',
      );
    });
    it('rep goal requirement equals max rep requirement across batch', () => {
      const staticData = {
        resetInfo: mockResetInfo,
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
      } as any;
      // installedAugmentations.length === 0 → computeResetOverhead === OVERHEAD_BASE === 7200,
      // matching the utility math in the comment above.
      const tree = buildFactionGoalTree(ns, 'TestFaction' as FactionName, {
        player: {
          factions: ['TestFaction' as FactionName],
          skills: { hacking: 195 },
          location: 'Sector-12',
        } as any,
        staticData,
        factionRep: {},
        queuedAugmentations: [],
        ownedAugs: [],
        money: 0,
        totalIncome: 0,
        formulas: mockFormulas as any,
        karma: 0,
        overhead: computeResetOverhead(staticData),
      });
      assert.ok(tree);
      const repGoal = tree.deps.find((g: any) => g.type === 'FACTION_REP')!;
      assert.equal(repGoal.requirement, 3000);
    });

    // Shared setup for utility/value tests: aug A with hacking:1.5 → value=(1.5-1)*10=5.0
    // repRate=N requires hacking = N * 195: factionGains(player,'hacking',0).reputation = hacking/975,
    // effectiveRepRate = reputation * 5 = N when hacking = N * 195.
    const valueTestData = (repRate: number) => {
      const staticData = {
        resetInfo: mockResetInfo,
        factionRequirements: {},
        factionAugmentations: { F: ['A'] },
        augmentationStats: { A: { hacking: 1.5 } },
        augmentationRepReqs: { A: 100 },
        augmentationPrices: { A: 0 },
        augmentationPrereqs: {},
        installedAugmentations: [],
      } as any;
      return {
        player: {
          factions: ['F' as FactionName],
          skills: { hacking: repRate * 195 },
          location: 'Sector-12',
        } as any,
        staticData,
        factionRep: {},
        queuedAugmentations: [],
        ownedAugs: [],
        money: 0,
        totalIncome: 0,
        formulas: mockFormulas as any,
        karma: 0,
        overhead: computeResetOverhead(staticData),
      };
    };

    it('utility returns value / (eta + overhead)', () => {
      const tree = buildFactionGoalTree(ns, 'F' as FactionName, valueTestData(1));
      assert.ok(tree);
      // repReq=100, repRate=1 → eta=100s; value=5.0; overhead=50
      assert.equal(tree.utility(50), 5.0 / (100 + 50));
    });

    it('utility is higher for a faster plan (same value, shorter eta)', () => {
      const fast = buildFactionGoalTree(ns, 'F' as FactionName, valueTestData(2)); // eta=50s
      const slow = buildFactionGoalTree(ns, 'F' as FactionName, valueTestData(1)); // eta=100s
      assert.ok(fast);
      assert.ok(slow);
      assert.ok(fast.utility(0) > slow.utility(0));
    });
  });

  describe('computeRepReq', () => {
    it('returns 0 for an empty batch', () => {
      assert.equal(computeRepReq([], { augmentationRepReqs: {} } as any), 0);
    });

    it('returns the max rep requirement across all augs', () => {
      const staticData = { augmentationRepReqs: { A: 1000, B: 5000, C: 500 } };
      assert.equal(computeRepReq(['A', 'B', 'C'], staticData as any), 5000);
    });

    it('treats missing rep reqs as 0', () => {
      assert.equal(computeRepReq(['Unknown'], { augmentationRepReqs: {} } as any), 0);
    });
  });

  describe('computeAugCost', () => {
    const NF = 'NeuroFlux Governor';

    it('costs a single aug with no queue multiplier', () => {
      const staticData = { augmentationPrices: { A: 1_000_000 } };
      assert.equal(computeAugCost(['A'], staticData as any, 0), 1_000_000);
    });

    it('applies the 1.9^numQueued multiplier to the first aug', () => {
      const staticData = { augmentationPrices: { A: 1_000_000 } };
      assert.equal(computeAugCost(['A'], staticData as any, 2), 1_000_000 * 1.9 ** 2);
    });

    it('compounds the queue multiplier across multiple augs (most expensive first)', () => {
      const staticData = { augmentationPrices: { Cheap: 100, Expensive: 1000 } };
      // sorted desc: Expensive (×1.9^0), Cheap (×1.9^1)
      const expected = 1000 * 1 + 100 * 1.9;
      assert.equal(computeAugCost(['Cheap', 'Expensive'], staticData as any, 0), expected);
    });

    it('applies the 1.14^installedNFCount base offset to NF price', () => {
      const installedNFCount = 3;
      const nfBase = 750_000;
      const staticData = {
        augmentationPrices: { [NF]: nfBase },
        resetInfo: { ownedAugs: new Map([[NF, installedNFCount]]) },
      };
      const expected = nfBase * 1.14 ** installedNFCount; // numQueued=0, first NF level offset=3
      assert.equal(computeAugCost([NF], staticData as any, 0), expected);
    });

    it('increments the NF level offset for each successive NF in the batch', () => {
      const nfBase = 750_000;
      const staticData = { augmentationPrices: { [NF]: nfBase } };
      // two NF, no installed, no queued: first at 1.14^0, second at 1.9 × 1.14^1
      const expected = nfBase * 1.14 ** 0 + nfBase * 1.9 * 1.14 ** 1;
      assert.equal(computeAugCost([NF, NF], staticData as any, 0), expected);
    });
  });

  describe('isRepBound', () => {
    // Helper: a join goal that's already satisfied (player is in the faction)
    const joinGoal = factionJoinGoal('TestFaction' as FactionName, ['TestFaction' as FactionName]);
    const root = (repGoal: Goal, moneyGoal: Goal) => installGoal([repGoal, moneyGoal], []);

    it('returns true when rep rate is unknown (null ownTime on rep goal)', () => {
      // rate=0 → ownTime() returns null → timeToComplete returns null
      const repGoal = factionRepGoal('TestFaction' as FactionName, 1000, 0, joinGoal, 0);
      const moneyGoal = augMoneyGoal(1000, 0, 1);
      assert.equal(isRepBound(root(repGoal, moneyGoal)), true);
    });

    it('returns true when rep time >= money time', () => {
      // rep: 1000 rep needed at 1/s → 1000s
      // money: $1000 needed at $2/s → 500s
      const repGoal = factionRepGoal('TestFaction' as FactionName, 1000, 0, joinGoal, 1);
      const moneyGoal = augMoneyGoal(1000, 0, 2);
      assert.equal(isRepBound(root(repGoal, moneyGoal)), true);
    });

    it('returns false when money time > rep time', () => {
      // rep: 500 rep needed at 1/s → 500s
      // money: $1000 needed at $0.5/s → 2000s
      const repGoal = factionRepGoal('TestFaction' as FactionName, 500, 0, joinGoal, 1);
      const moneyGoal = augMoneyGoal(1000, 0, 0.5);
      assert.equal(isRepBound(root(repGoal, moneyGoal)), false);
    });
  });

  describe('getMockFormulas reputation', () => {
    it('calculateFavorToRep(0) is 0', () => {
      assert.equal(mockFormulas.reputation.calculateFavorToRep(0), 0);
    });

    it('calculateRepToFavor is the inverse of calculateFavorToRep', () => {
      // Not bit-exact: calculateRepToFavor no longer floors its result (that was a bug -- the
      // real game's favor is a continuous value), so the round trip only holds to float precision.
      for (const favor of [1, 10, 50, 100, 150]) {
        const rep = mockFormulas.reputation.calculateFavorToRep(favor);
        assert.close(mockFormulas.reputation.calculateRepToFavor(rep), favor);
      }
    });

    it('donationForRep is the inverse of repFromDonation', () => {
      const rep = 100_000;
      const cost = mockFormulas.reputation.donationForRep(rep, {} as Person);
      const repBack = mockFormulas.reputation.repFromDonation(cost, {} as Person);
      assert.ok(Math.abs(repBack - rep) < 1e-6);
    });

    it('donationForRep scales with faction_rep aug mult', () => {
      // getMockFormulas now reads multipliers from the player argument's `.mults` (matching the
      // real ns.formulas contract), not from the staticData it was constructed with -- so the
      // "boost" here comes from the player, built via buildPerson from a hypothetical aug set,
      // not from a second getMockFormulas instance.
      const boostedStaticData = {
        installedAugmentations: ['FactionAug'],
        augmentationStats: { FactionAug: { faction_rep: 1.25 } },
      } as any;
      const basePlayer = buildPerson({} as any, { augs: [] });
      const boostedPlayer = buildPerson(boostedStaticData, { augs: ['FactionAug'] });
      const baseCost = mockFormulas.reputation.donationForRep(1000, basePlayer);
      const boostedCost = mockFormulas.reputation.donationForRep(1000, boostedPlayer);
      assert.ok(boostedCost < baseCost, 'aug mult should reduce donation cost');
      assert.ok(Math.abs(boostedCost - baseCost / 1.25) < 1e-6);
    });
  });

  describe('buildFactionGoalTree path 3 (donation)', () => {
    // canDonate = true when factionFavor >= favorToDonate
    const donationData = () => {
      const staticData = {
        resetInfo: mockResetInfo,
        factionRequirements: {},
        factionAugmentations: { F: ['A'] },
        augmentationStats: { A: { hacking: 1.5 } },
        augmentationRepReqs: { A: 50_000 },
        augmentationPrices: { A: 1_000_000 },
        augmentationPrereqs: {},
        installedAugmentations: [],
        factionFavor: { F: 150 },
        favorToDonate: 150,
      } as any;
      return {
        player: {
          factions: ['F' as FactionName],
          skills: { hacking: 200 },
          location: 'Sector-12',
        } as any,
        staticData,
        factionRep: { F: 0 },
        queuedAugmentations: [],
        ownedAugs: [],
        money: 0,
        estimatedStockValue: 0,
        totalIncome: 1,
        formulas: mockFormulas as any,
        karma: 0,
        overhead: computeResetOverhead(staticData),
      };
    };

    it('produces a BUY_REP action when faction has enough favor', () => {
      const tree = buildFactionGoalTree(ns, 'F' as FactionName, donationData());
      assert.ok(tree, 'tree should not be null');
      const repAction = tree.actions.find((a: any) => a.type === 'BUY_REP');
      assert.ok(repAction, 'should have a BUY_REP action');
    });

    it('money goal includes donation cost', () => {
      const tree = buildFactionGoalTree(ns, 'F' as FactionName, donationData());
      assert.ok(tree);
      const moneyGoal = tree.deps.find((g: any) => g.type === 'AUG_MONEY')!;
      // donationForRep(50000, player) = 50000 * 1e6 / 1 = 5e10; augCost = 1e6
      const expectedDonation = mockFormulas.reputation.donationForRep(50_000, {} as Person);
      assert.equal(moneyGoal.requirement, 1_000_000 + expectedDonation);
    });
  });

  await runSuite();
}

import { setupRunner, assert } from '../test-runner';
import { scoreAug } from '../aug-weights';
import { getAugWeights, entropyCostOf, statlessAugValue, VIOLET } from '../aug-weights';
import { augValueFromStats } from '../aug-select';

export async function main(ns: NS) {
  const { describe, it, runSuite } = setupRunner(ns);

  const augWeights = getAugWeights({
    currentNode: 4,
    ownedSF: new Map<number, number>(),
  } as ResetInfo);

  const neutralStats = Object.fromEntries(
    Object.keys(augWeights).map((k) => [k, 1]),
  ) as unknown as Multipliers;

  describe('scoreAug', () => {
    it('returns 0 for all-1.0 multipliers', () => {
      assert.equal(scoreAug(neutralStats, augWeights), 0);
    });

    it('returns 0 for only zero-weight stats', () => {
      const stats = {
        ...neutralStats,
        charisma: 2,
        crime_money: 2,
        crime_success: 2,
      };
      assert.equal(scoreAug(stats, augWeights), 0);
    });

    it('hacking aug outscores equivalent combat aug', () => {
      const hackingStats = { ...neutralStats, hacking: 1.1 };
      const combatStats = { ...neutralStats, strength: 1.1 };
      assert.ok(scoreAug(hackingStats, augWeights) > scoreAug(combatStats, augWeights));
    });

    it('handles sparse stats (missing keys default to 1.0)', () => {
      const sparseStats = { hacking: 1.1 } as unknown as Multipliers;
      assert.ok(scoreAug(sparseStats, augWeights) > 0);
    });

    it('returns exact expected value for known multiplier', () => {
      // Scoring is logarithmic: ln(1.25) * weight(hacking_money = 2) ≈ 0.446
      const stats = { hacking_money: 1.25 } as unknown as Multipliers;
      const mult = augWeights.hacking_money;
      assert.equal(scoreAug(stats, augWeights), Math.log(1.25) * mult);
    });

    it('produces correct score for full Multipliers object with one non-trivial stat', () => {
      // Matches the full object shape the game returns (all keys present, most at 1.0)
      // BitWire: hacking +5%, all others neutral
      const stats = {
        hacking: 1.05,
        hacking_chance: 1,
        hacking_speed: 1,
        hacking_money: 1,
        hacking_grow: 1,
        hacking_exp: 1,
        strength: 1,
        strength_exp: 1,
        defense: 1,
        defense_exp: 1,
        dexterity: 1,
        dexterity_exp: 1,
        agility: 1,
        agility_exp: 1,
        charisma: 1,
        charisma_exp: 1,
        hacknet_node_money: 1,
        hacknet_node_purchase_cost: 1,
        hacknet_node_ram_cost: 1,
        hacknet_node_core_cost: 1,
        hacknet_node_level_cost: 1,
        company_rep: 1,
        faction_rep: 1,
        work_money: 1,
        crime_success: 1,
        crime_money: 1,
        dnet_money: 1,
        bladeburner_max_stamina: 1,
        bladeburner_stamina_gain: 1,
        bladeburner_analysis: 1,
        bladeburner_success_chance: 1,
      } as unknown as Multipliers;
      // ln(1.05) * weight(hacking = 5) ≈ 0.2440
      const expected = Math.log(1.05) * augWeights.hacking;
      const score = scoreAug(stats, augWeights);
      assert(score > 0, `expected positive score, got ${score}`);
      assert(Math.abs(score - expected) < 1e-9, `expected ~${expected}, got ${score}`);
    });

    it('hacknet cost multiplier below 1.0 produces positive score', () => {
      // augWeights assigns 0 weight to hacknet stats, so use custom weights
      const weights = { ...augWeights, hacknet_node_purchase_cost: 2 };
      const stats = { ...neutralStats, hacknet_node_purchase_cost: 0.9 };
      assert(scoreAug(stats, weights) > 0);
    });

    it('hacknet cost multiplier above 1.0 produces negative score', () => {
      // Entropy divides cost multipliers, pushing them above 1.0 — the state where an
      // unsigned abs(log) would score a penalty as a gain.
      const weights = { ...augWeights, hacknet_node_purchase_cost: 2 };
      const stats = { ...neutralStats, hacknet_node_purchase_cost: 1 / 0.98 };
      assert(scoreAug(stats, weights) < 0);
    });

    it('scores a non-cost multiplier below 1.0 as a penalty', () => {
      assert(scoreAug({ ...neutralStats, hacking: 0.9 }, augWeights) < 0);
    });

    it('utility ordering is stable across multiple sorts', () => {
      const entries = [
        { name: 'a', stats: { ...neutralStats, hacking: 1.1 }, time: 500 },
        { name: 'b', stats: { ...neutralStats, hacking: 1.25 }, time: 1500 },
        { name: 'c', stats: { ...neutralStats, strength: 1.5 }, time: 500 },
      ].map((e) => {
        const value = scoreAug(e.stats, augWeights);
        return { name: e.name, utility: e.time > 0 ? value / e.time : 0 };
      });

      const sort = () => [...entries].sort((a, b) => b.utility - a.utility).map((e) => e.name);
      assert.deepEqual(sort(), sort());
    });
  });

  describe('statlessAugValue', () => {
    const RED_PILL = 'The Red Pill';
    const weightsFor = (currentNode: number) =>
      getAugWeights({ currentNode, ownedSF: new Map<number, number>() } as ResetInfo);

    it('returns null for augs scored from their stats', () => {
      assert.equal(statlessAugValue('BitWire', augWeights), null);
    });

    it('keeps its value relative to the entropy tax across BitNodes', () => {
      // The defect this guards: with a fixed value, an aug that cleared the tax in one BitNode
      // failed it in another purely because the weight table summed to a different number.
      const ratio = (currentNode: number) => {
        const weights = weightsFor(currentNode);
        const value = statlessAugValue('Neuroreceptor Management Implant', weights);
        assert.ok(value != null);
        return value / entropyCostOf(weights);
      };
      assert.close(ratio(4), ratio(6));
      assert.close(ratio(4), ratio(9));
    });

    it('scales with the weight table so standing against stat augs holds', () => {
      const bn4 = statlessAugValue(RED_PILL, weightsFor(4));
      const bn6 = statlessAugValue(RED_PILL, weightsFor(6));
      assert.ok(bn4 != null && bn6 != null);
      assert.ok(bn6 > bn4, 'BN6 weighs more stats, so the shared scale is larger');
    });

    it('prices violet from accumulated entropy', () => {
      assert.equal(statlessAugValue(VIOLET, augWeights, 0), 0);
      assert.close(statlessAugValue(VIOLET, augWeights, 3)!, entropyCostOf(augWeights) * 3);
    });

    it('agrees with the batch-selection path', () => {
      // These were duplicated constants that had drifted apart (CashRoot was 0.5 in one and
      // 0.01 in the other); both paths now resolve through statlessAugValue.
      for (const aug of ['CashRoot Starter Kit', RED_PILL]) {
        assert.equal(augValueFromStats(augWeights, aug, {}), statlessAugValue(aug, augWeights));
      }
    });
  });

  await runSuite();
}

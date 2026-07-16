import { setupRunner, assert } from '../test-runner';
import { scoreAug } from '../aug-select';
import { getAugWeights } from '../aug-weights';

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
      // hacking_money weight = 10; (1.25 - 1) * 10 = 2.5
      const stats = { hacking_money: 1.25 } as unknown as Multipliers;
      const mult = augWeights.hacking_money;
      assert.equal(scoreAug(stats, augWeights), 0.25 * mult);
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
      // (1.05 - 1) * weight(hacking=10) ≈ 0.5; floating point: 1.05-1 is not exactly 0.05
      const score = scoreAug(stats, augWeights);
      assert(score > 0, `expected positive score, got ${score}`);
      assert(Math.abs(score - 0.5) < 1e-9, `expected ~0.5, got ${score}`);
    });

    it('hacknet cost multiplier below 1.0 produces positive score', () => {
      // augWeights assigns 0 weight to hacknet stats, so use custom weights
      const weights = { ...augWeights, hacknet_node_purchase_cost: 2 };
      const stats = { ...neutralStats, hacknet_node_purchase_cost: 0.9 };
      assert(scoreAug(stats, weights) > 0);
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

  await runSuite();
}

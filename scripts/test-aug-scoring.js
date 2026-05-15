import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreAug, augEffectiveCost, DEFAULT_AUG_WEIGHTS } from '../home/lib/aug-select.js';

const neutralStats = /** @type {Multipliers} */ (
  Object.fromEntries(Object.keys(DEFAULT_AUG_WEIGHTS).map(k => [k, 1]))
);

test('scoreAug returns 0 for all-1.0 multipliers', () => {
  assert.strictEqual(scoreAug(neutralStats, DEFAULT_AUG_WEIGHTS), 0);
});

test('scoreAug returns 0 for only zero-weight stats', () => {
  const stats = { ...neutralStats, charisma: 2, crime_money: 2, crime_success: 2 };
  assert.strictEqual(scoreAug(stats, DEFAULT_AUG_WEIGHTS), 0);
});

test('hacking aug outscores equivalent combat aug', () => {
  const hackingStats = { ...neutralStats, hacking: 1.1 };
  const combatStats  = { ...neutralStats, strength: 1.1 };
  assert.ok(
    scoreAug(hackingStats, DEFAULT_AUG_WEIGHTS) > scoreAug(combatStats, DEFAULT_AUG_WEIGHTS),
  );
});

test('scoreAug handles sparse stats (missing keys default to 1.0)', () => {
  const sparseStats = /** @type {Multipliers} */ ({ hacking: 1.1 });
  assert.ok(scoreAug(sparseStats, DEFAULT_AUG_WEIGHTS) > 0);
});

test('scoreAug returns exact expected value for known multiplier', () => {
  // hacking_money weight = 10; (1.25 - 1) * 10 = 2.5
  const stats = /** @type {Multipliers} */ ({ hacking_money: 1.25 });
  assert.strictEqual(scoreAug(stats, DEFAULT_AUG_WEIGHTS), 2.5);
});

test('scoreAug produces correct score for full Multipliers object with one non-trivial stat', () => {
  // Matches the full object shape the game returns (all keys present, most at 1.0)
  // BitWire: hacking +5%, all others neutral
  const stats = /** @type {Multipliers} */ ({
    hacking: 1.05, hacking_chance: 1, hacking_speed: 1, hacking_money: 1, hacking_grow: 1, hacking_exp: 1,
    strength: 1, strength_exp: 1, defense: 1, defense_exp: 1,
    dexterity: 1, dexterity_exp: 1, agility: 1, agility_exp: 1,
    charisma: 1, charisma_exp: 1,
    hacknet_node_money: 1, hacknet_node_purchase_cost: 1, hacknet_node_ram_cost: 1,
    hacknet_node_core_cost: 1, hacknet_node_level_cost: 1,
    company_rep: 1, faction_rep: 1, work_money: 1,
    crime_success: 1, crime_money: 1,
    dnet_money: 1, bladeburner_max_stamina: 1, bladeburner_stamina_gain: 1,
    bladeburner_analysis: 1, bladeburner_success_chance: 1,
  });
  // (1.05 - 1) * weight(hacking=10) ≈ 0.5; floating point: 1.05-1 is not exactly 0.05
  const score = scoreAug(stats, DEFAULT_AUG_WEIGHTS);
  assert.ok(score > 0, `expected positive score, got ${score}`);
  assert.ok(Math.abs(score - 0.5) < 1e-9, `expected ~0.5, got ${score}`);
});

test('hacknet cost multiplier below 1.0 produces positive score', () => {
  const stats = { ...neutralStats, hacknet_node_purchase_cost: 0.9 };
  assert.ok(scoreAug(stats, DEFAULT_AUG_WEIGHTS) > 0);
});

test('utility ordering is stable across multiple sorts', () => {
  const MONEY_PER_REP = 4000;
  const entries = [
    { name: 'a', stats: { ...neutralStats, hacking: 1.10 }, price: 25e6,  repReq:  5_000 },
    { name: 'b', stats: { ...neutralStats, hacking: 1.25 }, price: 80e6,  repReq: 15_000 },
    { name: 'c', stats: { ...neutralStats, strength: 1.5 }, price: 25e6,  repReq:  5_000 },
  ].map(e => {
    const value = scoreAug(e.stats, DEFAULT_AUG_WEIGHTS);
    const cost  = augEffectiveCost(e.price, e.repReq, MONEY_PER_REP);
    return { name: e.name, utility: cost > 0 ? value / cost : 0 };
  });

  const sort = () => [...entries].sort((a, b) => b.utility - a.utility).map(e => e.name);
  assert.deepStrictEqual(sort(), sort());
});

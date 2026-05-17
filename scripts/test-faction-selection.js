import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectAugmentations } from '../home/lib/aug-select.js';

// ---------------------------------------------------------------------------
// Shared test data helpers
// ---------------------------------------------------------------------------

// utility = totalValue / (max(timeForMoney, marginalRepTime) + resetOverhead)
// All test augs use only the hacking multiplier for predictable math.
// Default rates: moneyRate=Infinity (money is free), repRate=1 (rep/s), overhead=1800s.

/** @param {number} hacking @param {number} price @param {number} repReq */
const hackAug = (hacking, price, repReq) => ({
  stats: /** @type {Multipliers} */ ({ hacking }),
  price,
  repReq,
});

// Netburners pool — cheap, low-rep, modest hacking multipliers
// All prices negligible (moneyRate=∞), so cost = marginalRep + 1800s.
// Best batch = all 3: totalValue=1.8, marginalRep=700, cost=2500, utility=0.00072
const NB_A = hackAug(1.10, 1_000_000,  1_000); // value=1.0
const NB_B = hackAug(1.05,   500_000,    500); // value=0.5
const NB_C = hackAug(1.03,   300_000,    300); // value=0.3

// CyberSec pool — higher multipliers, higher rep
// Best batch = both: totalValue=3.5, marginalRep=2000, cost=3800, utility=0.000921
const CS_A = hackAug(1.20, 5_000_000,  5_000); // value=2.0
const CS_B = hackAug(1.15, 3_000_000,  3_000); // value=1.5

// Sector-12 pool — high multipliers, reachable mid-game
const S12_A = hackAug(1.25, 3_000_000,  3_000); // value=2.5
const S12_B = hackAug(1.10, 1_000_000,  1_000); // value=1.0

const makeStaticData = (
  /** @type {Record<string, ReturnType<typeof hackAug>[]>} */ factionAugs,
  /** @type {Record<string, number>} */ numAugReqs = {},
) => {
  const augmentationStats = /** @type {Record<string, Multipliers>} */ ({});
  const augmentationPrices = /** @type {Record<string, number>} */ ({});
  const augmentationRepReqs = /** @type {Record<string, number>} */ ({});
  const augmentationPrereqs = /** @type {Record<string, string[]>} */ ({});
  const factionAugmentations = /** @type {Record<string, string[]>} */ ({});

  let idx = 0;
  for (const [faction, augs] of Object.entries(factionAugs)) {
    factionAugmentations[faction] = [];
    for (const aug of augs) {
      const name = `aug_${idx++}`;
      augmentationStats[name] = aug.stats;
      augmentationPrices[name] = aug.price;
      augmentationRepReqs[name] = aug.repReq;
      augmentationPrereqs[name] = [];
      factionAugmentations[faction].push(name);
    }
  }

  const factionRequirements = /** @type {Record<string, any[]>} */ (
    Object.fromEntries(
      Object.entries(numAugReqs).map(([f, n]) => [
        f, [{ type: 'numAugmentations', numAugmentations: n }],
      ])
    )
  );

  return {
    augmentationStats,
    augmentationPrices,
    augmentationRepReqs,
    augmentationPrereqs,
    factionAugmentations,
    factionRequirements,
    bitNodeMultipliers: {},
  };
};

const PLAYER = {skills: {}, factions: []};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('fresh start → CyberSec (higher-value batch wins over more augs at lower value)', () => {
  // CyberSec batch utility=0.000921 > Netburners batch utility=0.00072
  const data = makeStaticData({ Netburners: [NB_A, NB_B, NB_C], CyberSec: [CS_A, CS_B] });
  const { faction } = selectAugmentations([], data, PLAYER, undefined);
  assert.equal(faction, 'CyberSec');
});

test('Netburner augs owned → CyberSec becomes best', () => {
  const data = makeStaticData({ Netburners: [NB_A, NB_B, NB_C], CyberSec: [CS_A, CS_B] });
  const netburnerAugs = data.factionAugmentations['Netburners'];
  const { faction } = selectAugmentations(netburnerAugs, data, PLAYER, undefined);
  assert.equal(faction, 'CyberSec');
});

test('Netburners + CyberSec owned → city faction with hacking augs wins', () => {
  const data = makeStaticData({
    Netburners: [NB_A, NB_B, NB_C],
    CyberSec: [CS_A, CS_B],
    'Sector-12': [S12_A, S12_B],
  });
  const owned = [
    ...data.factionAugmentations['Netburners'],
    ...data.factionAugmentations['CyberSec'],
  ];
  const { faction } = selectAugmentations(owned, data, PLAYER, undefined);
  assert.equal(faction, 'Sector-12');
});

test('city exclusivity: player in Sector-12 cannot switch to Aevum', () => {
  const data = makeStaticData({
    'Sector-12': [S12_A],
    'Aevum': [hackAug(1.99, 1_000, 1)], // absurdly high utility, should be blocked
  });
  const { faction } = selectAugmentations([], data, {skills: {}, factions: ['Sector-12']});
  assert.equal(faction, 'Sector-12');
});

test('endgame faction gated by numAugmentations requirement', () => {
  const data = makeStaticData(
    {
      Netburners: [NB_A],
      Daedalus: [hackAug(2.00, 1_000, 1)], // best possible utility, but gated
    },
    { Daedalus: 30 }
  );
  // 0 owned augs — Daedalus requires 30
  const { faction } = selectAugmentations([], data, PLAYER);
  assert.equal(faction, 'Netburners');
});

test('endgame faction unlocks once numAugmentations threshold is met', () => {
  const data = makeStaticData(
    {
      Netburners: [NB_A],
      Daedalus: [hackAug(2.00, 1_000, 1)],
    },
    { Daedalus: 3 }
  );
  const fakeOwned = ['fake1', 'fake2', 'fake3']; // 3 owned augs
  const { faction } = selectAugmentations(fakeOwned, data, PLAYER);
  assert.equal(faction, 'Daedalus');
});

test('returns null faction when no accessible faction has any augs', () => {
  const data = makeStaticData({});
  const { faction, augmentations } = selectAugmentations([], data, PLAYER);
  assert.equal(faction, null);
  assert.deepEqual(augmentations, []);
});

test('faction with significant current rep is preferred over higher raw utility', () => {
  // BitRunners: high-value cheap aug that wins cold.
  // The Black Hand: two augs both gated at ≥45k rep; once unlocked they dominate (val=6.0 total).
  // BR_CHEAP needs val > 3.42 to win cold vs TBH[A+B] with OVERHEAD_BASE=7200:
  //   BR_CHEAP cold utility = val/7200; TBH[A+B] cold utility = 6.0/(7200+25000/repRate)
  const BR_CHEAP = hackAug(1.40,    100_000,  5_000); // value=4.0
  const TBH_A    = hackAug(1.50,     50_000, 45_000); // value=5.0 — gated at 45k rep
  const TBH_B    = hackAug(1.10,     50_000, 20_000); // value=1.0

  // Cold: BR_CHEAP utility≈0.000556; TBH[A+B]≈0.000475 (rep grind cost visible); BitRunners wins.
  const data = makeStaticData({
    'BitRunners':    [BR_CHEAP],
    'The Black Hand': [TBH_A, TBH_B],
  });

  const { faction: cold } = selectAugmentations([], data, PLAYER);
  assert.equal(cold, 'BitRunners');

  // With 45k rep in TBH: both TBH augs have remainingRep=0.
  // Batch [TBH_A, TBH_B]: marginalRep=0, cost=overhead only, utility=6.0/7200≈0.000833
  // BitRunners: cost=overhead only, utility=4.0/7200≈0.000556 — TBH wins.
  const { faction: withRep } = selectAugmentations([], data, PLAYER, undefined, { 'The Black Hand': 45_000 });
  assert.equal(withRep, 'The Black Hand');
});

// ---------------------------------------------------------------------------
// Deferred / backlog
// ---------------------------------------------------------------------------
// TODO: Player has manually grinded 450k rep in a city faction but only needs
//       one aug — verify BUY_REP path is preferred over grinding (Phase 3).
//
// TODO: Faction with a prereq chain — verify getPurchaseOrder includes prereqs
//       and the total list stays within MAX_AUGS.
//
// TODO: All augs from a faction are owned — verify that faction's utility is 0
//       and the next-best faction is selected.

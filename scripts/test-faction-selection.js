import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectAugmentations } from '../home/lib/aug-select.js';

// ---------------------------------------------------------------------------
// Shared test data helpers
// ---------------------------------------------------------------------------

// utility = (hacking - 1) * weight(10) / max(price / 4000, repReq)
// All test augs use only the hacking multiplier for predictable math.

const MONEY_PER_REP = 4000; // BN1 default, no bitNodeMultipliers

/** @param {number} hacking @param {number} price @param {number} repReq */
const hackAug = (hacking, price, repReq) => ({
  stats: /** @type {Multipliers} */ ({ hacking }),
  price,
  repReq,
});

// Netburners pool — cheap, low-rep, decent hacking multipliers
// Each aug: utility = (hacking-1)*10 / max(price/4000, repReq)
const NB_A = hackAug(1.10, 1_000_000,  1_000); // value=1.0 cost=max(250,1000)=1000 util=0.001
const NB_B = hackAug(1.05,   500_000,    500); // value=0.5 cost=500              util=0.001
const NB_C = hackAug(1.03,   300_000,    300); // value=0.3 cost=300              util=0.001
// Netburners total utility: 0.003

// CyberSec pool — pricier, higher multipliers
const CS_A = hackAug(1.20, 5_000_000,  5_000); // value=2.0 cost=5000            util=0.0004
const CS_B = hackAug(1.15, 3_000_000,  3_000); // value=1.5 cost=3000            util=0.0005
// CyberSec total utility: 0.0009 (< Netburners 0.003)

// Sector-12 pool — high multipliers, reachable mid-game
const S12_A = hackAug(1.25, 3_000_000,  3_000); // value=2.5 cost=3000           util=0.000833
const S12_B = hackAug(1.10, 1_000_000,  1_000); // value=1.0 cost=1000           util=0.001
// Sector-12 total utility: 0.001833 (> CyberSec 0.0009, all other factions 0)

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('fresh start → Netburners (highest utility, all reqs met)', () => {
  const data = makeStaticData({ Netburners: [NB_A, NB_B, NB_C], CyberSec: [CS_A, CS_B] });
  const { faction } = selectAugmentations([], data, undefined);
  assert.equal(faction, 'Netburners');
});

test('Netburner augs owned → CyberSec becomes best', () => {
  const data = makeStaticData({ Netburners: [NB_A, NB_B, NB_C], CyberSec: [CS_A, CS_B] });
  const netburnerAugs = data.factionAugmentations['Netburners'];
  const { faction } = selectAugmentations(netburnerAugs, data, undefined);
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
  const { faction } = selectAugmentations(owned, data, undefined);
  assert.equal(faction, 'Sector-12');
});

test('city exclusivity: player in Sector-12 cannot switch to Aevum', () => {
  const data = makeStaticData({
    'Sector-12': [S12_A],
    'Aevum': [hackAug(1.99, 1_000, 1)], // absurdly high utility, should be blocked
  });
  const { faction } = selectAugmentations([], data, 'Sector-12');
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
  const { faction } = selectAugmentations([], data, undefined);
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
  const { faction } = selectAugmentations(fakeOwned, data, undefined);
  assert.equal(faction, 'Daedalus');
});

test('returns null faction when no accessible faction has any augs', () => {
  const data = makeStaticData({});
  const { faction, augmentations } = selectAugmentations([], data, undefined);
  assert.equal(faction, null);
  assert.deepEqual(augmentations, []);
});

test('faction with significant current rep is preferred over higher raw utility', () => {
  // BitRunners: one cheap aug (good batch utility alone) + one expensive high-value aug
  // (the expensive aug inflates the binding rep constraint and tanks batch utility)
  // The Black Hand: two modest augs, player already has 90% of the rep
  const BR_CHEAP = hackAug(1.10,   100_000,   5_000); // value=1.0
  const BR_AUG   = hackAug(1.50, 1_000_000, 100_000); // value=5.0
  const TBH_A    = hackAug(1.20, 1_000_000,  50_000); // value=2.0
  const TBH_B    = hackAug(1.10, 1_000_000,  20_000); // value=1.0

  // Without rep progress:
  // BitRunners best batch = {BR_CHEAP} alone: cost=max(5000,25)=5000, utility=1.0/5000=0.0002
  // (adding BR_AUG: cost=100000, utility=6.0/100000=0.00006 — worse, so BR_CHEAP alone wins)
  // TBH best batch = {TBH_A,TBH_B}: cost=max(50000,500)=50000, utility=3.0/50000=0.00006
  // BitRunners wins (0.0002 > 0.00006) — BR_CHEAP is the sole target

  const data = makeStaticData({
    'BitRunners':    [BR_AUG, BR_CHEAP],
    'The Black Hand': [TBH_A, TBH_B],
  });

  const { faction: cold } = selectAugmentations([], data, undefined);
  assert.equal(cold, 'BitRunners');

  // With 45k rep in The Black Hand:
  // TBH_B: remaining=0, cost=max(0,250)=250, batch {TBH_B} utility=1.0/250=0.004
  // TBH batch {TBH_A,TBH_B}: bindingRep=5000, utility=3.0/5000=0.0006
  // Best TBH batch: {TBH_B} alone at utility=0.004 >> BitRunners 0.0002
  const { faction: withRep } = selectAugmentations([], data, undefined, { 'The Black Hand': 45_000 });
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

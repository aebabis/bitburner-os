import { test } from 'node:test';
import assert from 'node:assert/strict';
import { staticData } from './data/BN4-mock.js';
import { getAccessibleFactions, findOptimalBatch, MAX_AUGS } from '../home/lib/aug-select.js';
import { getMockFormulas } from '../home/lib/formulas.js';

const NEUROFLUX = 'NeuroFlux Governor';

const selectAugmentations = (
  ownedAugs: string[],
  staticData: any,
  player: any,
  formulas?: any,
  factionRep: Record<string, number> = {},
  { moneyRate = Infinity, repRate }: { moneyRate?: number; repRate?: number } = {},
) => {
  formulas ??= getMockFormulas(staticData);
  const {
    augmentationPrices,
    augmentationPrereqs,
    augmentationRepReqs,
    augmentationStats,
    factionAugmentations,
    factionRequirements,
  } = staticData;
  if (
    [
      augmentationPrices,
      augmentationRepReqs,
      augmentationPrereqs,
      augmentationStats,
      factionAugmentations,
      factionRequirements,
    ].some((d) => d == null)
  )
    return { faction: null, augmentations: [] as string[] };

  const stillNeeds = (aug: string) => !ownedAugs.includes(aug);
  const batchOpts = { moneyRate, repRate };

  let bestFaction: FactionName | null = null,
    bestUtility = -Infinity;
  for (const faction of getAccessibleFactions(staticData, player, ownedAugs)) {
    const faugs: string[] = factionAugmentations[faction] ?? [];
    if (!faugs.includes(NEUROFLUX) && faugs.filter(stillNeeds).length === 0) continue;
    const { utility } = findOptimalBatch(
      faction,
      staticData,
      player,
      formulas,
      factionRep,
      ownedAugs,
      batchOpts,
    );
    if (utility > bestUtility) {
      bestFaction = faction;
      bestUtility = utility;
    }
  }
  if (!bestFaction) return { faction: null, augmentations: [] as string[] };

  const { batch }: { batch: string[] } = findOptimalBatch(
    bestFaction,
    staticData,
    player,
    formulas,
    factionRep,
    ownedAugs,
    batchOpts,
  );
  const nfCount = batch.filter((a) => a === NEUROFLUX).length;
  const unique: string[] = batch
    .filter((a) => a !== NEUROFLUX)
    .sort((a, b) => (augmentationPrices[b] ?? 0) - (augmentationPrices[a] ?? 0));
  const order = new Set<string>();
  for (const aug of unique) {
    for (const prereq of ((augmentationPrereqs as Record<string, string[]>)[aug] ?? [])
      .filter(stillNeeds)
      .reverse())
      order.add(prereq);
    order.add(aug);
  }
  return {
    faction: bestFaction,
    augmentations: [...order, ...Array(nfCount).fill(NEUROFLUX)].slice(0, MAX_AUGS),
  };
};

// ---------------------------------------------------------------------------
// Shared test data helpers
// ---------------------------------------------------------------------------

// utility = totalValue / (max(timeForMoney, marginalRepTime) + resetOverhead)
// All test augs use only the hacking multiplier for predictable math.
// PLAYER has hacking=100 → overhead≈5628s (calculateExp(100)/mockHackExpPerSec),
// repRate≈0.513/s (mock factionGains at hacking=100), moneyRate=Infinity.

const hackAug = (hacking: number, price: number, repReq: number) => ({
  stats: { hacking } as unknown as Multipliers,
  price,
  repReq,
});

// Netburners pool — cheap, low-rep, modest hacking multipliers
// Best batch = all 3: totalValue=1.8, marginalRep=700, timeForRep≈1365s,
//   cost≈6993s, utility≈0.000257
const NB_A = hackAug(1.1, 1_000_000, 1_000); // value=1.0
const NB_B = hackAug(1.05, 500_000, 500); // value=0.5
const NB_C = hackAug(1.03, 300_000, 300); // value=0.3

// CyberSec pool — higher multipliers, higher rep
// Best batch = both: totalValue=3.5, marginalRep=2000, timeForRep≈3901s,
//   cost≈9529s, utility≈0.000367 (beats NB when overhead is large)
const CS_A = hackAug(1.2, 5_000_000, 5_000); // value=2.0
const CS_B = hackAug(1.15, 3_000_000, 3_000); // value=1.5

// Sector-12 pool — high multipliers, reachable mid-game
const S12_A = hackAug(1.25, 3_000_000, 3_000); // value=2.5
const S12_B = hackAug(1.1, 1_000_000, 1_000); // value=1.0

const makeStaticData = (
  factionAugs: Record<string, ReturnType<typeof hackAug>[]>,
  numAugReqs: Record<string, number> = {},
) => {
  const augmentationStats: Record<string, Multipliers> = {};
  const augmentationPrices: Record<string, number> = {};
  const augmentationRepReqs: Record<string, number> = {};
  const augmentationPrereqs: Record<string, string[]> = {};
  const factionAugmentations: Record<string, string[]> = {};

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

  const factionRequirements: Record<string, any[]> = Object.fromEntries(
    Object.entries(numAugReqs).map(([f, n]) => [
      f,
      [{ type: 'numAugmentations', numAugmentations: n }],
    ]),
  );

  return {
    resetInfo: { lastAugReset: 0, lastNodeReset: 0, currentNode: 1, ownedAugs: new Map() },
    augmentationStats,
    augmentationPrices,
    augmentationRepReqs,
    augmentationPrereqs,
    factionAugmentations,
    factionRequirements,
    installedAugmentations: [],
    bitNodeMultipliers: {},
  };
};

const PLAYER = { skills: { hacking: 100 }, factions: [] };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('fresh start → CyberSec (higher-value batch wins over more augs at lower value)', () => {
  // CyberSec batch utility=0.000921 > Netburners batch utility=0.00072
  const data = makeStaticData({
    Netburners: [NB_A, NB_B, NB_C],
    CyberSec: [CS_A, CS_B],
  });
  const { faction } = selectAugmentations([], data, PLAYER);
  assert.equal(faction, 'CyberSec');
});

test('Netburner augs owned → CyberSec becomes best', () => {
  const data = makeStaticData({
    Netburners: [NB_A, NB_B, NB_C],
    CyberSec: [CS_A, CS_B],
  });
  const netburnerAugs = data.factionAugmentations['Netburners'];
  const { faction } = selectAugmentations(netburnerAugs, data, PLAYER);
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
  const { faction } = selectAugmentations(owned, data, PLAYER);
  assert.equal(faction, 'Sector-12');
});

test('city exclusivity: player in Sector-12 cannot switch to Aevum', () => {
  const data = makeStaticData({
    'Sector-12': [S12_A],
    Aevum: [hackAug(1.99, 1_000, 1)], // absurdly high utility, should be blocked
  });
  const { faction } = selectAugmentations([], data, {
    skills: {},
    factions: ['Sector-12'],
  });
  assert.equal(faction, 'Sector-12');
});

test('endgame faction gated by numAugmentations requirement', () => {
  const data = makeStaticData(
    {
      Netburners: [NB_A],
      Daedalus: [hackAug(2.0, 1_000, 1)], // best possible utility, but gated
    },
    { Daedalus: 30 },
  );
  // 0 owned augs — Daedalus requires 30
  const { faction } = selectAugmentations([], data, PLAYER);
  assert.equal(faction, 'Netburners');
});

test('endgame faction unlocks once numAugmentations threshold is met', () => {
  const data = makeStaticData(
    {
      Netburners: [NB_A],
      Daedalus: [hackAug(2.0, 1_000, 1)],
    },
    { Daedalus: 3 },
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
  // Cold: BR_CHEAP utility≈4/5628≈0.000711; TBH[A+B] grind≈48757s+5628=54385, utility≈0.000110
  // BitRunners wins cold; once TBH has 45k rep both remainingRep=0, TBH utility=6/5628≈0.001066.
  const BR_CHEAP = hackAug(1.4, 100_000, 5_000); // value=4.0
  const TBH_A = hackAug(1.5, 50_000, 45_000); // value=5.0 — gated at 45k rep
  const TBH_B = hackAug(1.1, 50_000, 20_000); // value=1.0

  // Cold: BR_CHEAP utility≈0.000711; TBH[A+B]≈0.000110 (rep grind cost visible); BitRunners wins.
  const data = makeStaticData({
    BitRunners: [BR_CHEAP],
    'The Black Hand': [TBH_A, TBH_B],
  });

  const { faction: cold } = selectAugmentations([], data, PLAYER);
  assert.equal(cold, 'BitRunners');

  // With 45k rep in TBH: both TBH augs have remainingRep=0.
  // Batch [TBH_A, TBH_B]: marginalRep=0, cost=overhead only, utility=6.0/7200≈0.000833
  // BitRunners: cost=overhead only, utility=4.0/7200≈0.000556 — TBH wins.
  const { faction: withRep } = selectAugmentations([], data, PLAYER, undefined, {
    'The Black Hand': 45_000,
  });
  assert.equal(withRep, 'The Black Hand');
});

test('select The Syndicate over The Covenant when combat augs are still needed', () => {
  const ownedAugs = [
    'Hacknet Node Core Direct-Neural Interface',
    'Hacknet Node CPU Architecture Neural-Upload',
    'Hacknet Node NIC Architecture Neural-Upload',
    'Hacknet Node Kernel Direct-Neural Interface',
    'Hacknet Node Cache Architecture Neural-Upload',
    'Cranial Signal Processors - Gen I',
    'Cranial Signal Processors - Gen II',
    'Synaptic Enhancement Implant',
    'BitWire',
    'Neurotrainer I',
    'NeuroFlux Governor',
    'DataJack',
    'Embedded Netburner Module',
    'Artificial Synaptic Potentiation',
    'Neural-Retention Enhancement',
    'CRTX42-AA Gene Modification',
    'Neurotrainer II',
    'Neural Wit Amplifier',
    'LuminCloaking-V1 Skin Implant',
    'Wired Reflexes',
    'Neuroreceptor Management Implant',
    'Speech Processor Implant',
    'ADR-V1 Pheromone Gene',
    'Nanofiber Weave',
    'Speech Enhancement',
    'Nuoptimal Nootropic Injector Implant',
    'Social Negotiation Assistant (S.N.A)',
    'INFRARET Enhancement',
    'Augmented Targeting I',
    'Combat Rib I',
    'Combat Rib II',
    'DermaForce Particle Barrier',
    'CashRoot Starter Kit',
    'Augmented Targeting II',
    'Cranial Signal Processors - Gen III',
    'Magnetism Amplifier',
    'NutriGen Implant',
    'Neuregen Gene Modification',
    'Embedded Netburner Module Core Implant',
    'Neural Accelerator',
    'Cranial Signal Processors - Gen IV',
    'Cranial Signal Processors - Gen V',
    'Neuralstimulator',
    'Enhanced Myelin Sheathing',
    'The Black Hand',
    'Artificial Bio-neural Network Implant',
    'Embedded Netburner Module Core V2 Upgrade',
    'BitRunners Neurolink',
    'PCMatrix',
    'LuminCloaking-V2 Skin Implant',
    'Synfibril Muscle',
    'SmartSonar Implant',
    'Embedded Netburner Module Core V3 Upgrade',
    'Embedded Netburner Module Direct Memory Access Upgrade',
    'NEMEAN Subdermal Weave',
    'Embedded Netburner Module Analyze Engine',
    'Synthetic Heart',
    'The Red Pill',
  ];
  // Player at level 500 meets Syndicate requirements (≥200) but not Covenant's (≥850).
  // The exact winning faction depends on which criminal org has the best remaining batch,
  // but the key regression: The Covenant must NOT win (87M seconds training makes it uncompetitive).
  const player = {
    skills: {
      hacking: 500,
      strength: 500,
      defense: 500,
      dexterity: 500,
      agility: 500,
    },
    factions: [],
  };
  const { faction } = selectAugmentations(ownedAugs, staticData, player);
  assert(faction !== null, 'a faction should be selected');
  assert(faction !== 'The Covenant', 'The Covenant should not win when accessible factions remain');
});

test('cannot select faction when player is excluded by their employment', () => {
  const data = {
    ...staticData,
    factionAugmentations: {
      'Speakers for the Dead': ['DataJack'],
    },
  };

  const player = {
    ...PLAYER,
    jobs: { 'Central Intelligence Agency': 'a job' },
  };
  const { faction } = selectAugmentations([], data, player);
  assert.equal(faction, null);
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

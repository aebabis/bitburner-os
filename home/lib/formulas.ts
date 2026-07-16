import { getPlayerData, getStaticData, StaticData } from './data-store.ts';

// Hostname each gym/university location is backed by, for the backdoor-discount heuristic below.
const GYM_HOSTNAMES: Record<string, string> = {
  'Iron Gym': 'iron-gym',
  'Crush Fitness Gym': 'crush-fitness',
  'Millenium Fitness Gym': 'millenium-fitness',
  'Snap Fitness Gym': 'snap-fitness',
  'Powerhouse Gym': 'powerhouse-fitness',
};
const UNIVERSITY_HOSTNAMES: Record<string, string> = {
  'Rothman University': 'rothman-uni',
  'Summit University': 'summit-uni',
  'ZB Institute of Technology': 'zb-institute',
};

// Approximates the real game's 10% "backdoor installed" discount on gym/university costs by
// checking whether the player's hacking skill clears that server's backdoor requirement.
// Ignores port-opening prereqs and whether the player has actually run backdoor there.
const backdoorDiscount = (staticData: StaticData, player: Person, hostname: string | undefined) => {
  const requirement = staticData.serverBackdoorRequirements?.find((r) => r.hostname === hostname);
  if (!requirement) return 1;
  return (player.skills?.hacking ?? 0) >= requirement.requiredHackingLevel ? 0.9 : 1;
};

const WORK_STATS = {
  agiExp: 0,
  chaExp: 0,
  defExp: 0,
  dexExp: 0,
  hackExp: 0,
  intExp: 0,
  money: 0,
  reputation: 0,
  strExp: 0,
};

// Product, across a set of installed augmentations, of each aug's multiplier for one stat.
// Missing stats on an aug (or an unrecognized aug) default to neutral (1.0).
// `stat` stays a loose string (rather than keyof Multipliers) because some call sites below
// pass non-Multipliers keys like 'str_exp'; those always fall through to the 1.0 default.
export const augMultiplier = (staticData: StaticData, stat: string, augs: string[]) =>
  augs.reduce(
    (mult, aug) =>
      mult *
      ((staticData.augmentationStats?.[aug] as unknown as Record<string, number> | undefined)?.[
        stat
      ] ?? 1),
    1,
  );

const favorMult = (favor = 0) => 1 + favor / 100;

// Same formula the game uses for intelligence's passive bonus to hacking/rep/etc. Neutral (1x)
// at intelligence 0, so this is a no-op for players who haven't unlocked the stat.
const calculateIntelligenceBonus = (intelligence: number, weight = 1) =>
  1 + (weight * intelligence ** 0.8) / 600;

const calculateSkill = (exp: number, mult = 1) => {
  if (mult === 0) return 1;
  return Math.max(Math.floor(mult * (32 * Math.log(exp + 534.6) - 200)), 1);
};

// Mirrors the real calculateExp's floating-point correction: calculateSkill(calculateExp(skill))
// must round-trip back to at least `skill`, which a bare inverse can undershoot by float error.
const calculateExp = (skill: number, mult = 1) => {
  const floorSkill = Math.floor(skill);
  let value = Math.exp((skill / mult + 200) / 32) - 534.6;
  if (skill === floorSkill && Number.isFinite(skill) && Number.isFinite(value)) {
    let calcSkill = calculateSkill(value, mult);
    let diff = Math.abs(value * Number.EPSILON);
    let newValue = value;
    while (calcSkill < skill) {
      newValue = value + diff;
      diff *= 2;
      calcSkill = calculateSkill(newValue, mult);
    }
    value = newValue;
  }
  return Math.max(value, 0);
};

// Precise log(1.02): the literal 1.02 already loses precision as a float before Math.log even
// runs, so this constant (and MaxFavor) must match the game's exactly, not just visually.
const LOG_1_02 = 0.019802627296179712;
const MAX_FAVOR = 35331;

type MockFormulasOptions = {
  // Static approximation of ns.getSharePower() -- pass the live value for exact comparisons
  // (e.g. the mock-vs-real correctness suite); production callers default to "not sharing".
  sharePower?: number;
  // ns.hacknet.getStudyMult()/getTrainingMult(). Both cost RAM to query directly, so production
  // callers should source these from cached PlayerData (see pool.ts) rather than call live.
  studyMult?: number;
  trainingMult?: number;
};

/**
 * Mock of the ns.formulas namespace for use when Formulas.exe is not available.
 * Pass ns.formulas directly when it is available; use this otherwise.
 * Multipliers are read from each call's `player.mults`, matching the real API's contract, so
 * callers must pass a fully-populated Person (see buildPerson in test/fixtures.ts) rather than
 * relying on staticData.installedAugmentations to be reflected automatically.
 * @param {{
 *   hacknetMultipliers?: { production: number },
 *   bitNodeMultipliers?: BitNodeMultipliers
 * }} staticData
 */
export const getMockFormulas = (
  staticData: StaticData,
  { sharePower = 1, studyMult = 1, trainingMult = 1 }: MockFormulasOptions = {},
) => {
  const mult = (player: Person, stat: keyof Multipliers) => player.mults?.[stat] ?? 1;

  const {
    FactionWorkExpGain = 1,
    FactionWorkRepGain = 1,
    HackExpGain = 1,
    HackingSpeedMultiplier = 1,
    HacknetNodeMoney = 1,
  } = staticData.bitNodeMultipliers ?? {};

  const defaultProdMult = (staticData.hacknetMultipliers?.production ?? 1) * HacknetNodeMoney;

  const factionRepMult = (player: Person) => FactionWorkRepGain * mult(player, 'faction_rep');

  // SF15 (Source-File level 3+) grants a passive charisma bonus folded into faction rep gain.
  // ownedSF is the same underlying map activeSourceFileLvl reads from, modulo the rare
  // bitNodeOptions.sourceFileOverrides case (challenge-mode SF overrides) which isn't modeled.
  const darknetCharismaBonus = (player: Person, scalar: number) =>
    (staticData.resetInfo?.ownedSF?.get(15) ?? 0) >= 3
      ? (player.skills?.charisma ?? 0) * scalar
      : 0;

  return {
    skills: { calculateExp, calculateSkill },
    reputation: {
      calculateFavorToRep: (favor: number) => 25000 * (1.02 ** favor - 1),
      calculateRepToFavor: (rep: number) =>
        Math.min(Math.max(Math.log1p(rep / 25000) / LOG_1_02, 0), MAX_FAVOR),
      repFromDonation: (amount: number, player: Person) => (amount / 1e6) * factionRepMult(player),
      donationForRep: (reputation: number, player: Person) =>
        (reputation * 1e6) / factionRepMult(player),
    },
    hacking: {
      hackExp: (server: Server, player: Person) => {
        const baseDifficulty = server.baseDifficulty ?? 0;
        if (!baseDifficulty) return 0;
        return (3 + baseDifficulty * 0.3) * mult(player, 'hacking_exp') * HackExpGain;
      },
      hackTime: (server: Server, player: Person) => {
        const difficultyMult = (server.requiredHackingSkill ?? 1) * (server.hackDifficulty ?? 1);
        const skillFactor = (2.5 * difficultyMult + 500) / ((player.skills?.hacking ?? 1) + 50);
        const intelligenceBonus = calculateIntelligenceBonus(player.skills?.intelligence ?? 0);
        return (
          (5 * skillFactor * 1000) /
          (mult(player, 'hacking_speed') * HackingSpeedMultiplier * intelligenceBonus)
        );
      },
    },
    work: {
      factionGains: (player: Person, workType: FactionWorkType, favor: number) => {
        const intelligence = player.skills?.intelligence ?? 0;
        const intelligenceBonus = calculateIntelligenceBonus(intelligence);
        if (workType === 'hacking') {
          return {
            ...WORK_STATS,
            hackExp: (2 / 5) * mult(player, 'hacking_exp') * FactionWorkExpGain,
            reputation:
              (((player.skills?.hacking ?? 1) +
                intelligence / 3 +
                darknetCharismaBonus(player, 0.1)) /
                975) *
              factionRepMult(player) *
              intelligenceBonus *
              favorMult(favor) *
              sharePower,
          };
        }
        if (workType === 'field') {
          const skill =
            (player.skills.strength ?? 0) +
            (player.skills.defense ?? 0) +
            (player.skills.dexterity ?? 0) +
            (player.skills.agility ?? 0) +
            (player.skills.charisma ?? 0) +
            ((player.skills.hacking ?? 0) + intelligence + darknetCharismaBonus(player, 0.3)) *
              sharePower;
          return {
            ...WORK_STATS,
            hackExp: (1 / 5) * mult(player, 'hacking_exp') * FactionWorkExpGain,
            strExp: (1 / 5) * mult(player, 'strength_exp') * FactionWorkExpGain,
            defExp: (1 / 5) * mult(player, 'defense_exp') * FactionWorkExpGain,
            dexExp: (1 / 5) * mult(player, 'dexterity_exp') * FactionWorkExpGain,
            agiExp: (1 / 5) * mult(player, 'agility_exp') * FactionWorkExpGain,
            chaExp: (1 / 5) * mult(player, 'charisma_exp') * FactionWorkExpGain,
            reputation:
              ((0.9 * skill) / 975 / 5.5) *
              factionRepMult(player) *
              intelligenceBonus *
              favorMult(favor),
          };
        }
        if (workType === 'security') {
          const skill =
            (player.skills.strength ?? 0) +
            (player.skills.defense ?? 0) +
            (player.skills.dexterity ?? 0) +
            (player.skills.agility ?? 0) +
            darknetCharismaBonus(player, 0.3) +
            ((player.skills.hacking ?? 0) + intelligence) * sharePower;
          return {
            ...WORK_STATS,
            hackExp: (0.5 / 5) * mult(player, 'hacking_exp') * FactionWorkExpGain,
            strExp: (1.5 / 5) * mult(player, 'strength_exp') * FactionWorkExpGain,
            defExp: (1.5 / 5) * mult(player, 'defense_exp') * FactionWorkExpGain,
            dexExp: (1.5 / 5) * mult(player, 'dexterity_exp') * FactionWorkExpGain,
            agiExp: (1.5 / 5) * mult(player, 'agility_exp') * FactionWorkExpGain,
            reputation:
              ((0.9 * skill) / 975 / 4.5) *
              factionRepMult(player) *
              intelligenceBonus *
              favorMult(favor),
          };
        }
        throw new Error(`Not yet implemented: ${workType}`);
      },
      gymGains: (player: Person, gymType: GymType, locationName: LocationName) => {
        const gameCPS = 5;
        const gymMap: Record<
          string,
          { expField: keyof typeof WORK_STATS; multStat: keyof Multipliers }
        > = {
          str: { expField: 'strExp', multStat: 'strength_exp' },
          def: { expField: 'defExp', multStat: 'defense_exp' },
          dex: { expField: 'dexExp', multStat: 'dexterity_exp' },
          agi: { expField: 'agiExp', multStat: 'agility_exp' },
        };
        const locations: Record<string, { expMult: number; costMult: number }> = {
          'Iron Gym': { expMult: 1, costMult: 1 },
          'Crush Fitness Gym': { expMult: 2, costMult: 3 },
          'Millenium Fitness Gym': { expMult: 4, costMult: 7 },
          'Snap Fitness Gym': { expMult: 5, costMult: 10 },
          'Powerhouse Gym': { expMult: 10, costMult: 20 },
        };
        const gym = gymMap[gymType];
        const location = locations[locationName];
        const expScale = location.expMult / gameCPS;
        const discount = backdoorDiscount(staticData, player, GYM_HOSTNAMES[locationName]);
        return {
          ...WORK_STATS,
          [gym.expField]: expScale * mult(player, gym.multStat) * trainingMult,
          money: (-120 * location.costMult * discount) / gameCPS,
        };
      },
      // intExp is per the real Classes data but, like the real game, isn't multiplier-scaled --
      // there is no intelligence_exp Multipliers key.
      universityGains: (
        player: Person,
        classType: UniversityClassType,
        locationName: LocationName,
      ) => {
        const gameCPS = 5;
        const classes: Record<
          string,
          { hackExp?: number; chaExp?: number; intExp: number; money: number }
        > = {
          'Computer Science': { hackExp: 0.5, intExp: 0.01, money: 0 },
          'Data Structures': { hackExp: 1, intExp: 0.01, money: -40 },
          Networks: { hackExp: 2, intExp: 0.01, money: -80 },
          Algorithms: { hackExp: 4, intExp: 0.01, money: -320 },
          Management: { chaExp: 2, intExp: 0.01, money: -160 },
          Leadership: { chaExp: 4, intExp: 0.01, money: -320 },
        };
        const locations: Record<string, { expMult: number; costMult: number }> = {
          'Rothman University': { expMult: 2, costMult: 3 },
          'Summit University': { expMult: 3, costMult: 4 },
          'ZB Institute of Technology': { expMult: 4, costMult: 5 },
        };
        const classs = classes[classType];
        const location = locations[locationName];
        const expScale = (location.expMult / gameCPS) * studyMult;
        const discount = backdoorDiscount(staticData, player, UNIVERSITY_HOSTNAMES[locationName]);
        return {
          ...WORK_STATS,
          hackExp: (classs.hackExp ?? 0) * expScale * mult(player, 'hacking_exp'),
          chaExp: (classs.chaExp ?? 0) * expScale * mult(player, 'charisma_exp'),
          intExp: classs.intExp * expScale,
          money: (classs.money * location.costMult * discount) / gameCPS,
        };
      },
    },
    hacknetNodes: {
      moneyGainRate: (level: number, ram: number, cores: number, prodMult = defaultProdMult) =>
        prodMult * (level * 1.5) * 1.035 ** (ram - 1) * ((cores + 5) / 6),
    },
  };
};

export const hasFormulas = (ns: NS): boolean => {
  try {
    ns.formulas.hacking.weakenEffect(1);
    return true;
  } catch (error) {
    return false;
  }
};

export const formulas = (ns: NS, staticData?: StaticData) => {
  if (hasFormulas(ns)) return ns.formulas;
  const { studyMult, trainingMult } = getPlayerData(ns);
  return getMockFormulas(staticData ?? getStaticData(ns), { studyMult, trainingMult });
};

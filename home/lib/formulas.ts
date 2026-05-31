import { getStaticData, StaticData } from './data-store.ts';

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

const favorMult = (favor = 0) => 1 + favor / 100;

const calculateSkill = (exp: number, mult = 1) =>
  Math.max(Math.floor(mult * (32 * Math.log(exp + 534.5) - 200)), 1);

const calculateExp = (skill: number, mult = 1) =>
  Math.exp((skill / mult + 200) / 32) - 534.6;

/**
 * Mock of the ns.formulas namespace for use when Formulas.exe is not available.
 * Pass ns.formulas directly when it is available; use this otherwise.
 * @param {{
 *   installedAugmentations: string[],
 *   augmentationStats?: Record<string, Multipliers>,
 *   hacknetMultipliers?: { production: number },
 *   bitNodeMultipliers?: BitNodeMultipliers
 * }} staticData
 */
export const getMockFormulas = (staticData: StaticData, sharePower = 1) => {
  const getAugMult = (stat: string) =>
    staticData.installedAugmentations
      .map((aug: string) => staticData.augmentationStats?.[aug]?.[stat] ?? 1)
      .reduce((a, b) => a * b, 1);

  const {
    FactionWorkExpGain = 1,
    FactionWorkRepGain = 1,
    HacknetNodeMoney = 1,
  } = staticData.bitNodeMultipliers ?? {};

  const defaultProdMult =
    (staticData.hacknetMultipliers?.production ?? 1) * HacknetNodeMoney;

  const factionRepMult = () => FactionWorkRepGain * getAugMult('faction_rep');

  return {
    skills: { calculateExp, calculateSkill },
    reputation: {
      calculateFavorToRep: (favor: number) => 25000 * (1.02 ** favor - 1),
      calculateRepToFavor: (rep: number) =>
        Math.floor(Math.log(rep / 25000 + 1) / Math.log(1.02)),
      repFromDonation: (amount: number, _player: Person) =>
        (amount / 1e6) * factionRepMult(),
      donationForRep: (reputation: number, _player: Person) =>
        (reputation * 1e6) / factionRepMult(),
    },
    hacking: {
      hackExp: (server: Server, _player: Person) =>
        Math.max(1, (server.requiredHackingSkill ?? 1) / 30) *
        getAugMult('hacking_exp'),
      hackTime: (server: Server, player: Person) =>
        ((5 * (server.hackDifficulty ?? 1)) /
          ((player.skills?.hacking ?? 1) * getAugMult('hacking_speed'))) *
        1000,
    },
    work: {
      factionGains: (
        player: Person,
        workType: FactionWorkType,
        favor: number,
      ) => {
        if (workType === 'hacking') {
          return {
            ...WORK_STATS,
            hackExp: (2 / 5) * getAugMult('hacking_exp') * FactionWorkExpGain,
            reputation:
              ((player.skills?.hacking ?? 1) / 975) *
              factionRepMult() *
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
            (player.skills.hacking ?? 0) * sharePower;
          return {
            ...WORK_STATS,
            hackExp: (1 / 5) * getAugMult('hacking_exp') * FactionWorkExpGain,
            strExp: (1 / 5) * getAugMult('str_exp') * FactionWorkExpGain,
            defExp: (1 / 5) * getAugMult('def_exp') * FactionWorkExpGain,
            dexExp: (1 / 5) * getAugMult('dex_exp') * FactionWorkExpGain,
            agiExp: (1 / 5) * getAugMult('agi_exp') * FactionWorkExpGain,
            chaExp: (1 / 5) * getAugMult('cha_exp') * FactionWorkExpGain,
            reputation:
              ((0.9 * skill) / 975 / 5.5) * factionRepMult() * favorMult(favor),
          };
        }
        if (workType === 'security') {
          const skill =
            (player.skills.strength ?? 0) +
            (player.skills.defense ?? 0) +
            (player.skills.dexterity ?? 0) +
            (player.skills.agility ?? 0) +
            (player.skills.hacking ?? 0) * sharePower;
          return {
            ...WORK_STATS,
            hackExp: (0.5 / 5) * getAugMult('hacking_exp') * FactionWorkExpGain,
            strExp: (1.5 / 5) * getAugMult('str_exp') * FactionWorkExpGain,
            defExp: (1.5 / 5) * getAugMult('def_exp') * FactionWorkExpGain,
            dexExp: (1.5 / 5) * getAugMult('dex_exp') * FactionWorkExpGain,
            agiExp: (1.5 / 5) * getAugMult('agi_exp') * FactionWorkExpGain,
            reputation:
              ((0.9 * skill) / 975 / 4.5) * factionRepMult() * favorMult(favor),
          };
        }
        throw new Error(`Not yet implemented: ${workType}`);
      },
    },
    hacknetNodes: {
      moneyGainRate: (
        level: number,
        ram: number,
        cores: number,
        prodMult = defaultProdMult,
      ) => prodMult * (level * 1.5) * 1.035 ** (ram - 1) * ((cores + 5) / 6),
    },
  };
};

export const formulas = (ns: NS) => {
  if (ns.fileExists('Formulas.exe', 'home')) {
    return ns.formulas;
  } else {
    return getMockFormulas(getStaticData(ns), ns.getSharePower());
  }
};

/**
 * Construct a Person for use in Formulas API speculation.
 * Starts from the game's base mock (all-1 multipliers, all-1 skills) and
 * deep-merges the provided overrides for skills and mults.
 * Requires Formulas.exe.
 * @param {NS} ns
 * @param {{ skills?: Partial<Skills>, mults?: Partial<Multipliers> }} [overrides]
 * @returns {Person}
 */
export const speculativePerson = (ns: NS, { skills, mults } = {}) => {
  const base = ns.formulas.mockPerson();
  return {
    ...base,
    skills: { ...base.skills, ...skills },
    mults: { ...base.mults, ...mults },
  };
};

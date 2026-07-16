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

const calculateSkill = (exp: number, mult = 1) =>
  Math.max(Math.floor(mult * (32 * Math.log(exp + 534.5) - 200)), 1);

const calculateExp = (skill: number, mult = 1) => Math.exp((skill / mult + 200) / 32) - 534.6;

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
    augMultiplier(staticData, stat, staticData.installedAugmentations ?? []);

  const {
    FactionWorkExpGain = 1,
    FactionWorkRepGain = 1,
    HacknetNodeMoney = 1,
  } = staticData.bitNodeMultipliers ?? {};

  const defaultProdMult = (staticData.hacknetMultipliers?.production ?? 1) * HacknetNodeMoney;

  const factionRepMult = () => FactionWorkRepGain * getAugMult('faction_rep');

  return {
    skills: { calculateExp, calculateSkill },
    reputation: {
      calculateFavorToRep: (favor: number) => 25000 * (1.02 ** favor - 1),
      calculateRepToFavor: (rep: number) => Math.floor(Math.log(rep / 25000 + 1) / Math.log(1.02)),
      repFromDonation: (amount: number, _player: Person) => (amount / 1e6) * factionRepMult(),
      donationForRep: (reputation: number, _player: Person) =>
        (reputation * 1e6) / factionRepMult(),
    },
    hacking: {
      hackExp: (server: Server, _player: Person) =>
        Math.max(1, (server.requiredHackingSkill ?? 1) / 30) * getAugMult('hacking_exp'),
      hackTime: (server: Server, player: Person) =>
        ((5 * (server.hackDifficulty ?? 1)) /
          ((player.skills?.hacking ?? 1) * getAugMult('hacking_speed'))) *
        1000,
    },
    work: {
      factionGains: (player: Person, workType: FactionWorkType, favor: number) => {
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
            reputation: ((0.9 * skill) / 975 / 5.5) * factionRepMult() * favorMult(favor),
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
            reputation: ((0.9 * skill) / 975 / 4.5) * factionRepMult() * favorMult(favor),
          };
        }
        throw new Error(`Not yet implemented: ${workType}`);
      },
      gymGains: (_player: Person, gymType: GymType, locationName: LocationName) => {
        const gameCPS = 5;
        const gymMap: Record<string, { expField: keyof typeof WORK_STATS; augStat: string }> = {
          str: { expField: 'strExp', augStat: 'str_exp' },
          def: { expField: 'defExp', augStat: 'def_exp' },
          dex: { expField: 'dexExp', augStat: 'dex_exp' },
          agi: { expField: 'agiExp', augStat: 'agi_exp' },
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
        return {
          ...WORK_STATS,
          [gym.expField]: expScale * getAugMult(gym.augStat),
          money: (-120 * location.costMult) / gameCPS,
        };
      },
      universityGains: (
        _player: Person,
        classType: UniversityClassType,
        locationName: LocationName,
      ) => {
        const gameCPS = 5;
        const classes: Record<string, { hackExp?: number; chaExp?: number; money: number }> = {
          'Computer Science': { hackExp: 0.5, money: 0 },
          'Data Structures': { hackExp: 1, money: -40 },
          Networks: { hackExp: 2, money: -80 },
          Algorithms: { hackExp: 4, money: -320 },
          Management: { chaExp: 2, money: -160 },
          Leadership: { chaExp: 4, money: -320 },
        };
        const locations: Record<string, { expMult: number; costMult: number }> = {
          'Rothman University': { expMult: 2, costMult: 3 },
          'Summit University': { expMult: 3, costMult: 4 },
          'ZB Institute of Technology': { expMult: 4, costMult: 5 },
        };
        const classs = classes[classType];
        const location = locations[locationName];
        const expScale = location.expMult / gameCPS;
        return {
          ...WORK_STATS,
          hackExp: (classs.hackExp ?? 0) * expScale * getAugMult('hacking_exp'),
          chaExp: (classs.chaExp ?? 0) * expScale * getAugMult('cha_exp'),
          money: (classs.money * location.costMult) / gameCPS,
        };
      },
    },
    hacknetNodes: {
      moneyGainRate: (level: number, ram: number, cores: number, prodMult = defaultProdMult) =>
        prodMult * (level * 1.5) * 1.035 ** (ram - 1) * ((cores + 5) / 6),
    },
  };
};

export const formulas = (ns: NS, staticData?: StaticData) => {
  try {
    ns.formulas.hacking.weakenEffect(1);
    return ns.formulas;
  } catch (error) {
    return getMockFormulas(staticData ?? getStaticData(ns));
  }
};

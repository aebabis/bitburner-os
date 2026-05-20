import { getStaticData } from './data-store.js';

const WORK_STATS = {
  agiExp: 0, chaExp: 0, defExp: 0, dexExp: 0,
  hackExp: 0, intExp: 0, money: 0, reputation: 0, strExp: 0,
};

/** @param {number} [favor] */
const favorMult = (favor = 0) => 1 + favor / 100;

/** @param {number} exp @param {number} [mult] */
const calculateSkill = (exp, mult = 1) =>
  Math.max(Math.floor(mult * (32 * Math.log(exp + 534.5) - 200)), 1);

/** @param {number} skill @param {number} [mult] */
const calculateExp = (skill, mult = 1) =>
  Math.exp((skill / mult + 200) / 32) - 534.6;

/**
 * Mock of the ns.formulas namespace for use when Formulas.exe is not available.
 * Pass ns.formulas directly when it is available; use this otherwise.
 * @param {{
 *   installedAugmentations: string[],
 *   augmentationStats?: Record<string, Multipliers>,
 *   hacknetMultipliers?: { production: number },
 *   bitNodeMultipliers?: { HacknetNodeMoney: number },
 * }} staticData
 */
export const getMockFormulas = (staticData) => {
  const getAugMult = (/** @type {string} */ stat) =>
    staticData.installedAugmentations
      .map(aug => staticData.augmentationStats?.[aug]?.[/** @type {keyof Multipliers} */ (stat)] ?? 1)
      .reduce((a, b) => a * b, 1);

  const defaultProdMult =
    (staticData.hacknetMultipliers?.production ?? 1) *
    (staticData.bitNodeMultipliers?.HacknetNodeMoney ?? 1);

  return {
    skills: { calculateExp, calculateSkill },
    hacking: {
      /** @param {{requiredHackingSkill?: number}} server @param {Person} _player */
      hackExp: (server, _player) =>
        Math.max(1, (server.requiredHackingSkill ?? 1) / 30) * getAugMult('hacking_exp'),
      /** @param {{hackDifficulty?: number}} server @param {Person} player */
      hackTime: (server, player) =>
        5 * (server.hackDifficulty ?? 1) / ((player.skills?.hacking ?? 1) * getAugMult('hacking_speed')) * 1000,
    },
    work: {
      /** @param {Person} player @param {FactionWorkType} workType @param {number} [favor] */
      factionGains: (player, workType, favor) => {
        if (workType === 'hacking') {
          return {
            ...WORK_STATS,
            hackExp: 2 / 5 * getAugMult('hacking_exp'),
            reputation: ((player.skills?.hacking ?? 1) / 975) * getAugMult('faction_rep') * favorMult(favor),
          };
        }
        throw new Error(`Not yet implemented: ${workType}`);
      },
    },
    hacknetNodes: {
      /** @param {number} level @param {number} ram @param {number} cores @param {number} [prodMult] */
      moneyGainRate: (level, ram, cores, prodMult = defaultProdMult) =>
        prodMult * (level * 1.5) * 1.035 ** (ram - 1) * ((cores + 5) / 6),
    },
  };
};

/** @param {NS} ns */
export const formulas = (ns) => {
  if (ns.fileExists('Formulas.exe', 'home')) {
    return ns.formulas;
  } else {
    return getMockFormulas(getStaticData(ns));
  }
};

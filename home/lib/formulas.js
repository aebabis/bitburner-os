import { getStaticData } from "./data-store";

/** @param {number} exp @param {number} [mult] */
const calculateSkill = (exp, mult = 1) => {
  return Math.max(Math.floor(mult * (32 * Math.log(exp + 534.5) - 200)), 1);
};

/** @param {number} skill @param {number} [mult] */
const calculateExp = (skill, mult = 1) => {
  return Math.exp((skill / mult + 200) / 32) - 534.6;
};

/** @param {NS} ns */
export const getSkillFormulas = (ns) => {
  if (ns.fileExists("Formulas.exe", "home")) return ns.formulas.skills;
  return {
    calculateExp,
    calculateSkill,
  };
};

/** @param {NS} ns */
const getHacknetNodeIncomeFormula = (ns) => {
  if (ns.fileExists("Formulas.exe", "home"))
    return ns.formulas.hacknetNodes.moneyGainRate;
  const { hacknetMultipliers, bitNodeMultipliers } = getStaticData(ns);
  const prodMult =
    hacknetMultipliers.production * bitNodeMultipliers.HacknetNodeMoney;
  return (/** @type {number} */ level, /** @type {number} */ ram, /** @type {number} */ cores) =>
    prodMult * (level * 1.5) * 1.035 ** (ram - 1) * ((cores + 5) / 6);
};

/** @param {NS} ns */
export const getHacknetNodeFormulas = (ns) => {
  const income = getHacknetNodeIncomeFormula(ns);
  return {
    levelUpgradeProfit: (/** @type {number} */ level, /** @type {number} */ ram, /** @type {number} */ cores) =>
      income(level + 1, ram, cores) - income(level, ram, cores),
    ramUpgradeProfit: (/** @type {number} */ level, /** @type {number} */ ram, /** @type {number} */ cores) =>
      income(level, ram + 1, cores) - income(level, ram, cores),
    coreUpgradeProfit: (/** @type {number} */ level, /** @type {number} */ ram, /** @type {number} */ cores) =>
      income(level, ram, cores + 1) - income(level, ram, cores),
  };
};

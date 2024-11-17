import { getStaticData } from '/lib/data-store';

const calculateSkill = (exp, mult = 1) => {
  return Math.max(Math.floor(mult * (32 * Math.log(exp + 534.5) - 200)), 1);
}

const calculateExp = (skill, mult = 1) => {
  return Math.exp((skill / mult + 200) / 32) - 534.6;
}

export const getSkillFormulas = (ns) => {
    if (ns.fileExists('Formulas.exe', 'home'))
        return ns.formulas.skills;
    return {
        calculateExp,
        calculateSkill,
    };
}

const getHacknetNodeIncomeFormula = (ns) => {
    if (ns.fileExists('Formulas.exe', 'home'))
        return ns.formulas.hacknetNodes.moneyGainRate;
    const { hacknetMultipliers, bitNodeMultipliers } = getStaticData(ns);
    const prodMult = hacknetMultipliers.production * bitNodeMultipliers.HacknetNodeMoney;
    return (level, ram, cores) => prodMult * (level*1.5) * (1.035**(ram-1)) * ((cores+5)/6);
};

export const getHacknetNodeFormulas = (ns) => {
    const income = getHacknetNodeIncomeFormula(ns);
    return {
        levelUpgradeProfit: (level, ram, cores) => income(level+1, ram, cores) - income(level, ram, cores),
        ramUpgradeProfit:   (level, ram, cores) => income(level, ram+1, cores) - income(level, ram, cores),
        coreUpgradeProfit:  (level, ram, cores) => income(level, ram, cores+1) - income(level, ram, cores),
    };
};

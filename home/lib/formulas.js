import { getStaticData } from './lib/data-store';

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
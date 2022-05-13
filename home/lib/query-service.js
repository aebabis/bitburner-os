import {
    // getHostnames,
    getStaticData,
    // getGangData,
    // getDataboardData,
    // getRamData,
    getPlayerData,
    getMoneyData,
} from './lib/data-store';

const DAY = 60 * 60 * 24;
export const getTimeEstimates = (ns) => {
    const { money, income, costToAug } = getMoneyData(ns);
    const { factionRep, factionRepRate } = getPlayerData(ns);
    const { targetFaction, repNeeded } = getStaticData(ns);

    const moneyTime = costToAug ? (costToAug-money) / income : DAY;
    const repRate = factionRepRate ? factionRepRate[targetFaction] : 1;
    const repAcquired = factionRep ? factionRep[targetFaction] : 0;

    const repRemaining = repNeeded - repAcquired;
    const repTime = repRemaining / repRate;

    return { moneyTime, repTime };
};

export const estimateTimeToAug = (ns) => {
    const { moneyTime, repTime } = getTimeEstimates(ns);
    return Math.max(moneyTime, repTime);
};

export const isMoneyBound = (ns) => {
    const { moneyTime, repTime } = getTimeEstimates(ns);
    return moneyTime > repTime;
};

/** @param {NS} ns **/
const queryService = (ns) => {
    return {
        estimateTimeToAug: () => estimateTimeToAug(ns),
    };
};

/** @param {NS} ns **/
export async function main(ns) {
    const [func, ...rest] = ns.args;
    ns.tprint(queryService(ns)[func](...rest));
}

export default queryService;
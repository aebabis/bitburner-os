import {
    // getHostnames,
    getStaticData,
    // getGangData,
    // getDataboardData,
    getRamData,
    getPlayerData,
    getMoneyData,
} from './lib/data-store';

const cache = func => {
    let data;
    return (ns) => {
        if (data === undefined)
            data = func(ns);
        return data;
    };
};

const getRamInfo = cache((ns) => {
    const { purchasedServerCosts, requiredJobRam } = getStaticData(ns);
    return { purchasedServerCosts, requiredJobRam };
});

export const getJobRamCost = cache((ns) => {
    const { purchasedServerCosts, requiredJobRam } = getRamInfo(ns);
    return purchasedServerCosts[requiredJobRam];
});

const DAY = 60 * 60 * 24;
export const getTimeEstimates = (ns) => {
    const { money, income, costToAug, estimatedStockValue: stock=0 } = getMoneyData(ns);
    const { factionRep, activeRepRate={}, passiveRepRate={} } = getPlayerData(ns);
    const { targetFaction } = getStaticData(ns);

    const moneyTime = costToAug != null ? (costToAug-money-stock) / income : DAY;
    // Because activeRepRate includes passiveRepRate implicitly with no
    // known way to separate the two, we only use active when possible
    const repRate = activeRepRate[targetFaction] || passiveRepRate[targetFaction] || .1;
    const repAcquired = factionRep != null ? factionRep[targetFaction] : 0;

    const repRemaining = getRepNeeded(ns) - repAcquired;
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

export const isRepBound = (ns) => {
    const { moneyTime, repTime } = getTimeEstimates(ns);
    return repTime > moneyTime;
};

export const needsJobRam = (ns) => {
    const { requiredJobRam } = getRamInfo(ns);
    const { rootServers, purchasedServers } = getRamData(ns);

    const homeRam = rootServers.find(s=>s.hostname==='home').maxRam;
    const jobRam = purchasedServers[0]?.maxRam || 0;

    return homeRam < requiredJobRam * 2 && jobRam < requiredJobRam;
};

export const estimateTimeToGoal = (ns) => {
    if (needsJobRam(ns)) {
        const jobRamCost = getJobRamCost(ns);
        const { money, income } = getMoneyData(ns);
        return (jobRamCost - money) / income;
    } else {
        return estimateTimeToAug(ns);
    }
};

export const getGoalCost = (ns) => getMoneyData(ns).costToAug || getJobRamCost(ns);

export const getRepNeeded = (ns) => {
    const { targetAugmentations, augmentationRepReqs } = getStaticData(ns);
    if (targetAugmentations == null)
        return null;
    const repCosts = targetAugmentations.map(aug=>augmentationRepReqs[aug]);
    return Math.max(...repCosts, 0);
};

export const shouldWorkHaveFocus = (ns) => {
    const { isPlayerActive } = getPlayerData(ns);
    const { ownedAugmentations } = getStaticData(ns);
    if (ownedAugmentations == null)
        return !isPlayerActive;
    if (ownedAugmentations.includes('Neuroreceptor Management Implant'))
        return false;
    return !isPlayerActive;
}

export const hasBitNode = (ns, bn) => {
    const { bitNodeN, ownedSourceFiles } = getStaticData(ns);
    const inBN = bitNodeN === bn;
    const beatBN = ownedSourceFiles.find(file => file.n === bn);
    return inBN || beatBN;
}

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
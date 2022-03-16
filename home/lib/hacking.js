import { WEAKEN } from './etc/filenames';

/** @param {NS} ns **/
export const getWThreads = (ns, targetDecrease, cores=1) => {
    const weakSize = ns.getScriptRam(WEAKEN);
    const maxRam = ns.getPurchasedServerMaxRam();
    let min = 0;
    let max = Math.ceil(maxRam / weakSize);
    while (max > min) {
        const weakThreads = Math.floor((min + max) / 2);
        const secDecrease = ns.weakenAnalyze(weakThreads, cores);
        if (secDecrease < targetDecrease) {
            min = weakThreads + 1;
        } else {
            max = weakThreads - 1;
        }
    }
    return Math.ceil(min) || 1;
}

/** @param {NS} ns **/
export const getHThreads = (ns, target, portion) => Math.floor(portion / ns.hackAnalyze(target));

/** @param {NS} ns **/
export const getGWThreads = (ns, server, multiplier, maxThreads, cores=1) => {
    if (multiplier === Infinity) {
        return { grow: maxThreads, weak: 0 };
    }
    const threads = Math.min(maxThreads, ns.growthAnalyze(server, multiplier, cores))
    let min = 0;
    let max = threads;
    while (min < max) {
        const growThreads = Math.floor((min + max) / 2);
        const weakThreads = threads - growThreads;
        const secIncrease = ns.growthAnalyzeSecurity(growThreads);
        const secDecrease = ns.weakenAnalyze(weakThreads, cores);
        if (secIncrease < secDecrease) {
            min = growThreads + 1;
        } else {
            max = growThreads - 1;
        }
    }
    const grow = Math.floor(min);
    const weak = maxThreads - grow;
    return { grow, weak };
}

/** @param {Server} server **/
export const isServerGroomed = ({
    hasAdminRights, moneyAvailable, moneyMax,
    minDifficulty, hackDifficulty, purchasedByPlayer,
}) => (
    hasAdminRights && !purchasedByPlayer &&
    moneyAvailable / moneyMax > .99 &&
    minDifficulty / hackDifficulty > .99
);

/** @param {Server} server **/
export const isServerUngroomed = ({
    hasAdminRights, moneyAvailable, moneyMax,
    minDifficulty, hackDifficulty, purchasedByPlayer,
}) => (
    hasAdminRights && !purchasedByPlayer &&
    (moneyAvailable < moneyMax || minDifficulty < hackDifficulty)
);
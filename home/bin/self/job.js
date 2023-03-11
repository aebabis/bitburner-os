import { shouldWorkHaveFocus } from './lib/query-service';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const focus = shouldWorkHaveFocus(ns);
    ns.singularity.workForCompany('Joe\'s Guns', focus);
    await ns.sleep(10000);
}
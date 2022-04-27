import { disableService } from './lib/planner-api';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    ns.workForCompany('Joe\'s Guns');
    await ns.sleep(10000);
    ns.stopAction();
}
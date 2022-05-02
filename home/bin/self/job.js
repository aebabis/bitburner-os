import { disableService } from './lib/planner-api';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const focus = ns.args[0] === 'true';
    ns.workForCompany('Joe\'s Guns', focus);
    await ns.sleep(10000);
    ns.stopAction();
}
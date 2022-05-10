import { rmi } from './lib/rmi';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    while (!ns.gang.inGang())
        await ns.sleep(1000);

    await rmi(ns)('/bin/gang/gang-data.js');

    while (true) {
        await rmi(ns)('/bin/gang/recruit.js');
        await rmi(ns)('/bin/gang/assign-members.js');
        await ns.sleep(5000);
    }
}

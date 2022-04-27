import { afkTracker } from './lib/tracking';
import { rmi } from './lib/rmi';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const isAfk = afkTracker(ns);

    while (true) {
        await rmi(ns)('/bin/self/apply.js');
        if (isAfk()) {
            const player = ns.getPlayer();
            const stats = ['strength', 'defense', 'dexterity', 'agility', 'charisma'].map(s=>player[s]);
            const doneWithJoes = stats.every(stat => stat >= 5);
            if (!doneWithJoes) {
                await rmi(ns)('/bin/self/job.js');
            } else {
                await rmi(ns)('/bin/self/crime-stats.js');
                await rmi(ns)('/bin/self/crime.js');
            }
        }
        await ns.sleep(100);
    }
}
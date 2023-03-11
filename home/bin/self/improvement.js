import { shouldWorkHaveFocus } from './lib/query-service';

/** @param {NS} ns */
export async function main(ns) {
    const [stat, goal] = ns.args;
    const focus = shouldWorkHaveFocus(ns);
    ns.singularity.gymWorkout('Powerhouse Gym', stat, focus);
    const cutoff = Date.now() + 10000;
    while (ns.getPlayer()[stat] < goal && Date.now() < cutoff)
        await ns.sleep(50);
}
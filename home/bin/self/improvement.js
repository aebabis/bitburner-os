import { shouldWorkHaveFocus } from '/lib/query-service';
import { putPlayerData  } from '/lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
    const [stat, goal] = ns.args;
    const focus = shouldWorkHaveFocus(ns);
    ns.singularity.gymWorkout('Powerhouse Gym', stat, focus);
    putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
    const cutoff = Date.now() + 10000;
    while (ns.getPlayer()[stat] < goal && Date.now() < cutoff)
        await ns.sleep(50);
}

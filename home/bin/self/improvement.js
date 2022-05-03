/** @param {NS} ns */
export async function main(ns) {
    const [stat, focus] = ns.args;
    ns.gymWorkout('Powerhouse Gym', stat, focus);
    await ns.sleep(10000);
}
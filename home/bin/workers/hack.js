/** @param {NS} ns */
export async function main(ns) {
    const target = ns.args[0];
    const jobId = ns.args[1];
    const actualStart = Date.now();
    const result = await ns.hack(target);
    globalThis.__profiler?.recordActual?.(jobId, actualStart, Date.now(), result);
}

/** @param {NS} ns */
export async function main(ns) {
  const target = /** @type {string} */ ns.args[0];
  const jobId = /** @type {string} */ ns.args[1];
  const actualStart = Date.now();
  globalThis.__profiler?.recordStart?.(jobId, actualStart);
  const result = await ns.weaken(target);
  globalThis.__profiler?.recordActual?.(jobId, actualStart, Date.now(), result);
}

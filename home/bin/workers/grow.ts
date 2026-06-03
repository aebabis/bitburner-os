export async function main(ns: NS) {
  const [target, jobId] = ns.args as string[];
  const actualStart = Date.now();
  globalThis.__profiler?.recordStart?.(jobId, actualStart);
  const result = await ns.grow(target);
  globalThis.__profiler?.recordActual?.(jobId, actualStart, Date.now(), result);
}

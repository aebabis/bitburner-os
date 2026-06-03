export async function main(ns: NS) {
  const [target, baseStartTime, jobId] = ns.args as [string, number, string];
  // globalThis.__profiler?.recordStart?.(jobId, actualStart);
  const additionalMsec = baseStartTime - Date.now();
  const result = await ns.grow(target, { additionalMsec });
  ns.tprint('grow - ' + result);
  // globalThis.__profiler?.recordActual?.(jobId, actualStart, Date.now(), result);
}

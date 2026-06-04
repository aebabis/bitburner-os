export async function main(ns: NS) {
  const [target, baseStartTime, jobId, debug] = ns.args as [
    string,
    number,
    string,
    boolean,
  ];
  // globalThis.__profiler?.recordStart?.(jobId, actualStart);
  const additionalMsec = baseStartTime - Date.now();
  const result = await ns.hack(target, { additionalMsec });
  if (debug) ns.tprint('hack - ' + result);
  // globalThis.__profiler?.recordActual?.(jobId, actualStart, Date.now(), result);
}

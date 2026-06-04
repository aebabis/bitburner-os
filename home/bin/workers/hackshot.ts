export async function main(ns: NS) {
  const [target, additionalMsec, jobId, debug] = ns.args as [
    string,
    number,
    string,
    boolean,
  ];
  const actualStart = Date.now();
  globalThis.__profiler?.recordStart?.(jobId, actualStart);
  const result = await ns.hack(target, { additionalMsec });
  if (debug) ns.tprint('hack - ' + result);
  globalThis.__profiler?.recordActual?.(jobId, actualStart, Date.now(), result);
}

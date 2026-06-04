const ERROR = `\u001b[38;5;${124}m`;

export async function main(ns: NS) {
  const [target, baseStartTime, jobId, debug] = ns.args as [
    string,
    number,
    string,
    boolean,
  ];
  const actualStart = Date.now();
  globalThis.__profiler?.recordStart?.(jobId, actualStart);
  const additionalMsec = baseStartTime - Date.now();
  if (additionalMsec < 0) {
    ns.tprint(ERROR + 'Negative additionalMsec. Are you lagging?');
    return;
  }
  const result = await ns.weaken(target, { additionalMsec });
  if (debug) ns.tprint('weak - ' + result);
  globalThis.__profiler?.recordActual?.(jobId, actualStart, Date.now(), result);
}

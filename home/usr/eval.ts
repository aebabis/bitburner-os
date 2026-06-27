export async function main(ns: NS) {
  const scriptName = `tmp/bin/${Date.now()}-exec.ts`;
  ns.write(scriptName, `export async function main(ns: NS){ns.tprint(${ns.args[0]});}`);
  const pid = ns.run(scriptName);
  if (pid) {
    while (ns.isRunning(pid)) {
      await ns.sleep(50);
    }
  }
  ns.rm(scriptName);
}

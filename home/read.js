/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();

  const [filename] = ns.args;
  if (filename == null) throw new Error(`Must specify file as argument`);
  while (true) {
    const content = await ns.read(/** @type {string} */ (filename));
    ns.clearLog();
    ns.print(content);
    await ns.sleep(5000);
  }
}

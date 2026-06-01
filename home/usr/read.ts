export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.ui.openTail();

  const [filename] = ns.args;
  if (typeof filename !== 'string')
    throw new Error(`Must specify file as argument`);
  while (true) {
    const content = ns.read(filename);
    ns.clearLog();
    ns.print(content);
    await ns.sleep(1000);
  }
}

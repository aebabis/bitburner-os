export async function main(ns: NS) {
  if (ns.getHostname() !== 'home') throw new Error(ns.getScriptName() + ' can only run on home');
  await ns.sleep(50); // To avoid RAM problems on 8GB machines
  ns.disableLog('ALL');
  ns.run('/boot/boot.ts', 1);
}

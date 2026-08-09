import { getHostnames } from '../lib/data-store';

export async function main(ns: NS) {
  const hostnames = getHostnames(ns);
  const [home, n00dles] = hostnames;
  while (ns.getHackingLevel() < 5) {
    const HOME_RAM = ns.getServerMaxRam(home);
    const THIS_RAM = ns.getScriptRam('/bin/eight-gig.ts');
    const HACK_RAM = ns.getScriptRam('/bin/workers/hack.ts');
    const threads = Math.floor((HOME_RAM - THIS_RAM) / HACK_RAM);
    ns.run('/bin/workers/hack.ts', threads, n00dles);
    await ns.hack(n00dles);
  }
  await ns.sleep(5000);
  // Using run here since run already used above.
  // planner.ts can still start in BN1.1 because
  // eight-gig and planner are less than 8GB total
  ns.run('/bin/planner.ts');
}

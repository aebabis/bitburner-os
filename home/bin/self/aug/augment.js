import { rmi } from "../../../lib/rmi";

/** @param {NS} ns */
export async function main(ns) {
  ns.tprint('?');
  const retry = true;

  await rmi(ns, retry)("/bin/self/aug/load-faction-favor.js");
  await rmi(ns, retry)("/bin/self/aug/load-aug-names.js");
  await rmi(ns, retry)("/bin/self/aug/load-aug-prices.js");
  await rmi(ns, retry)("/bin/self/aug/load-aug-reps.js");
  await rmi(ns, retry)("/bin/self/aug/load-aug-prereqs.js");
  await rmi(ns, retry)("/bin/self/aug/load-aug-stats.js");
  await rmi(ns, retry)("/bin/self/aug/load-faction-reqs.js");

  while (true) {
    await rmi(ns, retry)("/bin/self/aug/load-owned-augs.js");
    await rmi(ns, retry)("/bin/self/aug/load-faction-favor-gain.js");
    await rmi(ns)("/bin/self/aug/join-factions.js");
    await rmi(ns)("/bin/self/aug/purchase-augs.js");
    await ns.sleep(100);
  }
}

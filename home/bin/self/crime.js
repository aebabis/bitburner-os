import { getPlayerData, putPlayerData } from "../../lib/data-store";

/** @typedef {{name: string, chance: number, time: number, expectedValue: number}} CrimeStat */

/** @param {NS} ns @param {number|null} maxDuration */
const selectCrime = (ns, maxDuration) => {
  const { crimeStats } = getPlayerData(ns);
  if (crimeStats == null) return "Shoplift";

  const PATIENCE = 90 * 1000;
  const allowedCrimes = crimeStats
    .filter((/** @type {CrimeStat} */ c) => maxDuration == null || c.time * 1000 <= maxDuration)
    .filter((/** @type {CrimeStat} */ c) => c.chance === 1 || c.chance >= c.time / PATIENCE,
  );

  const bestCrime = allowedCrimes.reduce((/** @type {CrimeStat} */ a, /** @type {CrimeStat} */ b) =>
    a.expectedValue > b.expectedValue ? a : b,
  );

  return bestCrime.name;
};

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  const crime = typeof ns.args[0] === 'string' ? ns.args[0]
    : selectCrime(ns, +ns.args[0] || null);
  const duration = ns.singularity.commitCrime(crime);
  putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
  await ns.sleep(duration);
  putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
}

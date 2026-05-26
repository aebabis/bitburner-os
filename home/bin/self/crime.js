import { getPlayerData, putPlayerData } from "../../lib/data-store";

/** @typedef {{name: string, chance: number, time: number, expectedValue: number}} CrimeStat */

/** @param {NS} ns @param {number|null} maxDuration */
const selectCrime = (ns, maxDuration) => {
  const { player, crimeStats } = getPlayerData(ns);
  if (crimeStats == null) return "Shoplift";

  const homicide = crimeStats.find((/** @type {CrimeStat} */ c) => c.name === "Homicide");
  if (homicide.chance > 0.5 && player.numPeopleKilled < 30)
    return "Homicide";

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

  const maxDuration = +ns.args[0] || null;

  const crime = selectCrime(ns, maxDuration);
  const duration = ns.singularity.commitCrime(crime);
  putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
  await ns.sleep(duration);
  putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
}

import { getPlayerData, putPlayerData } from '../../lib/data-store';

type CrimeStat = {
  name: string;
  chance: number;
  time: number;
  expectedValue: number;
};

const selectCrime = (ns: NS, maxDuration: number | null) => {
  const { crimeStats } = getPlayerData(ns);
  if (crimeStats == null) return 'Shoplift';

  const PATIENCE = 90 * 1000;
  const allowedCrimes = crimeStats
    .filter(
      (c: CrimeStat) => maxDuration == null || c.time * 1000 <= maxDuration,
    )
    .filter((c: CrimeStat) => c.chance === 1 || c.chance >= c.time / PATIENCE);

  if (allowedCrimes.length === 0) {
    return 'Shoplift';
  }

  const bestCrime = allowedCrimes.reduce((a: CrimeStat, b: CrimeStat) =>
    a.expectedValue > b.expectedValue ? a : b,
  );

  return bestCrime.name;
};

export async function main(ns: NS) {
  ns.disableLog('ALL');

  const crime =
    typeof ns.args[0] === 'string'
      ? ns.args[0]
      : selectCrime(ns, +ns.args[0] || null);
  if (ns.singularity.getCurrentWork().crimeType !== crime) {
    const duration = ns.singularity.commitCrime(crime);
    putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
    await ns.sleep(duration);
    putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
  }
}

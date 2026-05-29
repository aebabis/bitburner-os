import { getPlayerData, putPlayerData } from '../../lib/data-store';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  const crimeStats = getPlayerData(ns).crimeStats.map((stats) => {
    const { money, time } = stats;
    const chance = ns.singularity.getCrimeChance(stats.name);
    return {
      ...stats,
      chance,
      expectedValue: (chance * money) / time,
    };
  });
  putPlayerData(ns, { crimeStats });
}

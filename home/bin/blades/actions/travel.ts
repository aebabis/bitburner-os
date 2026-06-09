import { putBladeData } from '../../../lib/data-store';
import { table } from '../../../lib/table';
import { by } from '../../../lib/util';

export async function main(ns: NS) {
  const CITIES = Object.values(ns.enums.CityName);
  const cityStats = CITIES.map((city) => ({
    city,
    estimatedPopulation: ns.bladeburner.getCityEstimatedPopulation(city),
    chaos: ns.bladeburner.getCityChaos(city),
    communities: ns.bladeburner.getCityCommunities(city),
  }));
  const mostPopulated = cityStats.reduce((a, b) =>
    a.estimatedPopulation > b.estimatedPopulation ? a : b,
  );
  ns.bladeburner.switchCity(mostPopulated.city);

  const columns = [
    'CITY',
    { name: 'EST POP' },
    { name: 'CMTY', align: 'right' },
    { name: ' CHAOS', align: 'right' },
  ];
  const rows = cityStats
    .sort(by((stats) => -stats.estimatedPopulation))
    .map((stats) => [
      stats.city,
      ns.format.number(stats.estimatedPopulation).padStart(8),
      stats.communities,
      ns.format.number(stats.chaos).replace(/^0/, ' '),
    ]);
  putBladeData(ns, {
    Locations: table(ns, columns, rows, { colors: true }),
  });
}

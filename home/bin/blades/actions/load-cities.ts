import { BladeAction, putBladeData } from '../../../lib/data-store';

export async function main(ns: NS) {
  const { bladeburner: bb } = ns;

  const CITIES = Object.values(ns.enums.CityName);

  const getCityStats = (city: CityName) => ({
    estimatedPopulation: ns.bladeburner.getCityEstimatedPopulation(city),
    chaos: ns.bladeburner.getCityChaos(city),
    communities: ns.bladeburner.getCityCommunities(city),
  });

  const cities = Object.fromEntries(
    CITIES.map((city) => [city, getCityStats(city)]),
  ) as Record<CityName, ReturnType<typeof getCityStats>>;

  putBladeData(ns, { cities });
}

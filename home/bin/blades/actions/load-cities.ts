import { putBladeData } from '../../../lib/data-store';
import { joinSpawnChain } from '../../../lib/service-api';

export async function main(ns: NS) {
  const { linkTo } = joinSpawnChain(ns, '/bin/blades/blades.ts');

  const CITIES = Object.values(ns.enums.CityName);

  const getCityStats = (city: CityName) => ({
    estimatedPopulation: ns.bladeburner.getCityEstimatedPopulation(city),
    chaos: ns.bladeburner.getCityChaos(city),
    communities: ns.bladeburner.getCityCommunities(city),
  });

  const cities = Object.fromEntries(CITIES.map((city) => [city, getCityStats(city)])) as Record<
    CityName,
    ReturnType<typeof getCityStats>
  >;

  putBladeData(ns, { cities });
  await linkTo('/bin/blades/actions/upgrade-skills.ts', 0);
}

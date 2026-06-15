import { getBladeData } from '../../../lib/data-store';
import { joinSpawnChain } from '../../../lib/service-api';

export async function main(ns: NS) {
  const { linkTo } = joinSpawnChain(ns, '/bin/blades/blades.ts');

  const { cities } = getBladeData(ns);
  const CITIES = Object.values(ns.enums.CityName);
  const mostPopulated = CITIES.reduce((a, b) =>
    cities[a].estimatedPopulation > cities[b].estimatedPopulation ? a : b,
  );
  ns.bladeburner.switchCity(mostPopulated);

  await linkTo('/bin/blades/actions/check-stamina.ts', 0);
}

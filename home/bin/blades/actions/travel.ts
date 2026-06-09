import { getBladeData } from '../../../lib/data-store';

export async function main(ns: NS) {
  const { cities } = getBladeData(ns);
  const CITIES = Object.values(ns.enums.CityName);
  const mostPopulated = CITIES.reduce((a, b) =>
    cities[a].estimatedPopulation > cities[b].estimatedPopulation ? a : b,
  );
  ns.bladeburner.switchCity(mostPopulated);
}

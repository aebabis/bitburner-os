export async function main(ns: NS) {
  const cityStats = Object.values(ns.enums.CityName).map((city) => ({
    city,
    estimatedPopulation: ns.bladeburner.getCityEstimatedPopulation(city),
  }));
  const mostPopulated = cityStats.reduce((a, b) =>
    a.estimatedPopulation > b.estimatedPopulation ? a : b,
  );
  ns.bladeburner.switchCity(mostPopulated.city);
}

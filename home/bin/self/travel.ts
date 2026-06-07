export async function main(ns: NS) {
  ns.disableLog('ALL');
  const [destination] = ns.args;
  // Safety check prevents continuous cash drain
  if (ns.getPlayer().city !== destination)
    ns.singularity.travelToCity(destination as CityName);
}

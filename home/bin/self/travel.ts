export async function main(ns: NS) {
  ns.disableLog('ALL');
  const [destination] = ns.args;
  // Safety check prevents continuous cash drain
  if (ns.getPlayer().location !== destination)
    ns.singularity.travelToCity(destination as CityName);
}

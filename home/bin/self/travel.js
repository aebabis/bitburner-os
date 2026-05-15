/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  const [location] = ns.args;
  if (typeof location !== 'string' || !Object.values(ns.enums.CityName).includes(location)) {
    throw new Error('Expected location parameter. Got ' + location);
  }
  // Safety check prevents continuous cash drain
  if (ns.getPlayer().location !== location)
    ns.singularity.travelToCity(location);
}

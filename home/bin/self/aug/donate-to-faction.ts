export async function main(ns: NS) {
  const [factionName, amount] = ns.args;
  ns.singularity.donateToFaction(factionName as FactionName, amount as number);
}

export async function main(ns: NS) {
  ns.disableLog('ALL');
  let ram = 1;
  let max = ns.cloud.getRamLimit();
  while (ram <= max) {
    const cost = (
      '$' + ns.format.number(ns.cloud.getServerCost(ram), 3)
    ).padStart(10);
    ns.tprint(ram.toString().padStart(10) + ' ' + cost);
    ram *= 2;
  }
}

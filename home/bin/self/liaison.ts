import { getPlayerData, putPlayerData } from '../../lib/data-store';
import { FACTIONS } from '../../lib/factions';
import { table } from '../../lib/table';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  const { factionRep = /** @type {Record<string, number>} */ {} } =
    getPlayerData(ns);

  while (true) {
    for (const faction of FACTIONS) {
      factionRep[faction] = ns.singularity.getFactionRep(faction);
    }

    const n = (/** @type {number} */ num) => ns.format.number(num || 0, 1);
    const tableData = FACTIONS.slice()
      .sort()
      .map((faction) => [faction, n(factionRep[faction])]);
    ns.clearLog();
    ns.print(table(ns, ['FACTION', 'REP'], tableData));

    putPlayerData(ns, { factionRep });
    await ns.sleep(200);
  }
}

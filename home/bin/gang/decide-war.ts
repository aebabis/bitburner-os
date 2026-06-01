import { putGangData } from '../../lib/data-store';
import { getAverageClashWinChance } from './util';

export async function main(ns: NS) {
  const [gangName] = ns.args as string[];

  const allGangInfo = ns.gang.getAllGangInformation();

  putGangData(ns, { allGangInfo });

  const { territory } = allGangInfo[gangName];
  const clashWinChance = getAverageClashWinChance(gangName, allGangInfo);

  if (territory < 0.99 && clashWinChance > 0.55) {
    ns.gang.setTerritoryWarfare(true);
    await ns.sleep(11000);
  } else {
    ns.gang.setTerritoryWarfare(false);
  }
}

import { putGangData } from '../../lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
  const [gangName] = ns.args;

  const otherGangInformation = ns.gang.getAllGangInformation();
  const { power, territory } =
    otherGangInformation[/** @type {string} */ gangName];
  delete otherGangInformation[/** @type {string} */ gangName];

  const enemyInfo = Object.entries(otherGangInformation).map(
    ([faction, info]) => ({
      faction,
      ...info,
      clashWinChance: power / (power + info.power),
    }),
  );
  const livingEnemies = enemyInfo.filter((e) => e.territory > 0);
  const averageWinChance =
    livingEnemies.map((e) => e.clashWinChance).reduce((a, b) => a + b, 0) /
    livingEnemies.length;
  putGangData(ns, { power, territory, enemyInfo });

  if (territory < 0.99 && averageWinChance > 0.55) {
    ns.gang.setTerritoryWarfare(true);
    await ns.sleep(11000);
  } else {
    ns.gang.setTerritoryWarfare(false);
  }
}

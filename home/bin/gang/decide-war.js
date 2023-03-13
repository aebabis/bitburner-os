import { putGangData } from './lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
    const [gangName, clashChance] = ns.args;

    const otherGangInformation = ns.gang.getOtherGangInformation();
    const { power, territory } = otherGangInformation[gangName];
    delete otherGangInformation[gangName];

    const enemyInfo = Object.entries(otherGangInformation).map(([faction, info]) => ({
        faction,
        ...info,
        clashWinChance: power / (power + info.power),
    }));
    const livingEnemies = enemyInfo.filter(e=>e.territory > 0);
    const averageWinChance = livingEnemies.map(e=>e.clashWinChance)
        .reduce((a,b)=>a+b,0) / livingEnemies.length;
    putGangData(ns, { power, territory, enemyInfo });

    if (territory < .99 && averageWinChance > .55) {
        ns.gang.setTerritoryWarfare(true);
        await ns.sleep(11000);
    } else {
        ns.gang.setTerritoryWarfare(false);
    }
}
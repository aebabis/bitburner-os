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

    putGangData(ns, { power, territory, enemyInfo });

    if (clashChance > 0) {
        ns.gang.setTerritoryWarfare(false);
        return;
    }

    if (territory > .99)
        return;

    const totalExpectedValue = enemyInfo
        .filter(e=>e.territory > 0)
        .map(e=>e.clashWinChance)
        .reduce((a,b)=>a+b, 0);

    if (totalExpectedValue > .55) {
        ns.gang.setTerritoryWarfare(true);
        await ns.sleep(11000);
        ns.gang.setTerritoryWarfare(false);
    }
}
/** @param {NS} ns */
export async function main(ns) {
    const [gangName, clashChance] = ns.args;

    if (clashChance > 0) {
        ns.gang.setTerritoryWarfare(false);
        return;
    }

    const otherGangInformation = ns.gang.getOtherGangInformation();
    const { power, territory } = otherGangInformation[gangName];
    delete otherGangInformation[gangName];

    if (territory > .99)
        return;

    const enemies = Object.values(otherGangInformation);
    const expectedValue = (enemy) => enemy.territory === 0 ? 0 : power / (power + enemy.power);
    const totalExpectedValue = enemies.map(expectedValue).reduce((a,b)=>a+b, 0);

    if (totalExpectedValue > .55) {
        ns.gang.setTerritoryWarfare(true);
        await ns.sleep(11000);
        ns.gang.setTerritoryWarfare(false);
    }
}
/** @param {NS} ns */
export async function main(ns) {
    const [gangName, clashChance] = ns.args;

    if (clashChance > 0) {
        ns.gang.setTerritoryWarfare(false);
        return;
    }

    const gangInfo = ns.gang.getOtherGangInformation();
    const { power, territory } = gangInfo[gangName];
    delete gangInfo[gangName];

    if (territory > .99)
        return;

    const enemies = Object.values(gangInfo);
    const expectedValue = (enemy) => enemy.territory === 0 ? 0 : power / (power + enemy.power);
    const totalExpectedValue = enemies.map(expectedValue).reduce((a,b)=>a+b, 0);

    if (totalExpectedValue > .55)
        ns.gang.setTerritoryWarfare(true);
}
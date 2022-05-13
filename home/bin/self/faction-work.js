import { getPlayerData, putPlayerData } from './lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const [faction, focus] = ns.args;
    if (
        ns.workForFaction(faction, 'Hacking Contracts', focus) ||
        ns.workForFaction(faction, 'Field Work', focus) ||
        ns.workForFaction(faction, 'Security Work', focus)
    ) {
        const DELAY = 10;
        await ns.sleep(DELAY * 1000);

        const { factionRep = {}, factionRepRate = {} } = getPlayerData(ns);
        factionRep[faction] = ns.getFactionRep(faction);
        factionRepRate[faction] = ns.getPlayer().workRepGained / DELAY;
        putPlayerData(ns, { factionRep, factionRepRate });
    }
}

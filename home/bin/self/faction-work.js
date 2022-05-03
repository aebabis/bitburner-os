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
        await ns.sleep(10000);

        const { factionRep = {} } = getPlayerData(ns);
        factionRep[faction] = ns.getFactionRep(faction);
        putPlayerData(ns, { factionRep });
    }
}

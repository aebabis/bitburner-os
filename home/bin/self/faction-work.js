import { getPlayerData, putPlayerData } from './lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const [faction] = ns.args;
    if (
        ns.workForFaction(faction, 'Hacking Contracts') ||
        ns.workForFaction(faction, 'Field Work') ||
        ns.workForFaction(faction, 'Security Work')
    ) {
        await ns.sleep(10000);
        ns.stopAction();

        const { factionRep = {} } = getPlayerData(ns);
        factionRep[faction] = ns.getFactionRep(faction);
        putPlayerData(ns, { factionRep });
    }
}

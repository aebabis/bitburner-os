import { shouldWorkHaveFocus } from './lib/query-service';
import { getPlayerData, putPlayerData } from './lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const [faction] = ns.args;
    const focus = shouldWorkHaveFocus(ns);
    if (
        ns.workForFaction(faction, 'Hacking Contracts', focus) ||
        ns.workForFaction(faction, 'Field Work', focus) ||
        ns.workForFaction(faction, 'Security Work', focus)
    ) {
        const DELAY = 10;
        await ns.sleep(DELAY * 1000);

        const { factionRep = {}, activeRepRate = {} } = getPlayerData(ns);
        factionRep[faction] = ns.getFactionRep(faction);
        activeRepRate[faction] = ns.getPlayer().workRepGained / DELAY;
        putPlayerData(ns, { factionRep, activeRepRate });
    }
}

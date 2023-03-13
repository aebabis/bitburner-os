import { shouldWorkHaveFocus } from './lib/query-service';
import { getPlayerData, putPlayerData } from './lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const [faction] = ns.args;
    const focus = shouldWorkHaveFocus(ns);
    if (
        ns.singularity.workForFaction(faction, 'Hacking Contracts', focus) ||
        ns.singularity.workForFaction(faction, 'Field Work', focus) ||
        ns.singularity.workForFaction(faction, 'Security Work', focus)
    ) {
        putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
        const DELAY = 10;
        await ns.sleep(DELAY * 1000);

        const { factionRep = {}, activeRepRate = {} } = getPlayerData(ns);
        factionRep[faction] = ns.singularity.getFactionRep(faction);
        activeRepRate[faction] = ns.getPlayer().workRepGained / DELAY;
        putPlayerData(ns, { factionRep, activeRepRate,
            currentWork: ns.singularity.getCurrentWork() });
    }
}
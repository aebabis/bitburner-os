import { getPlayerData, putPlayerData } from './lib/data-store';
import { FACTIONS } from './bin/self/aug/factions';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const { factionRep = {}, passiveRepRate = {}, lastRepRecorded } = getPlayerData(ns);
    const now = Date.now();
    const dt = now - lastRepRecorded;

    for (const faction of FACTIONS) {
        // Prevent double-counting
        if (ns.getPlayer().currentWorkFactionName === faction)
            continue;
        const prevRep = factionRep[faction] || 0;
        const curRep = ns.getFactionRep(faction);
        const gain = curRep - prevRep;

        factionRep[faction] = curRep;

        if (gain > 0 && lastRepRecorded != null)
            passiveRepRate[faction] = gain/(dt/1000);
    }

    putPlayerData(ns, { factionRep, passiveRepRate, lastRepRecorded: now });
}

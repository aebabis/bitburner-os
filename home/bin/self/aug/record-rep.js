import { getPlayerData, putPlayerData, getStaticData } from './lib/data-store';
import { FACTIONS } from './bin/self/aug/factions';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const { factionRep = {}, factionRepRate = {}, lastRepRecorded } = getPlayerData(ns);
    const { targetFaction } = getStaticData(ns);
    const now = Date.now();
    const dt = now - lastRepRecorded;

    for (const faction of FACTIONS) {
        // TODO: Come up with a better way to record work vs not.
        // Would prolly involve tracking active and passive gain separately
        if (!ns.gang.inGang() && faction === targetFaction)
            continue;
        const prevRep = factionRep[faction] || 0;
        const curRep = ns.getFactionRep(faction);
        const gain = curRep - prevRep;

        factionRep[faction] = curRep;

        if (gain > 0 && lastRepRecorded != null)
            factionRepRate[faction] = gain/(dt/1000);
    }

    putPlayerData(ns, { factionRep, factionRepRate, lastRepRecorded: now });
}

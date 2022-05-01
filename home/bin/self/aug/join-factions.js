import { getStaticData, putStaticData  } from './lib/data-store';
import { CITY_FACTIONS } from './bin/self/aug/factions';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const { cityFaction } = getStaticData(ns);
    const invites = ns.checkFactionInvitations();
    for (const faction of invites) {
        if (!CITY_FACTIONS.includes(faction) || faction === cityFaction)
            ns.joinFaction(faction);
    }
}

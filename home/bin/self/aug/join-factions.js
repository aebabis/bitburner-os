import { getStaticData  } from './lib/data-store';
import { CITY_FACTIONS } from './bin/self/aug/factions';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const { cityFaction, targetFaction } = getStaticData(ns);
    const invites = ns.singularity.checkFactionInvitations();
    for (const faction of invites) {
        if (faction === cityFaction || faction === targetFaction || !CITY_FACTIONS.includes(faction))
            ns.singularity.joinFaction(faction);
    }
}
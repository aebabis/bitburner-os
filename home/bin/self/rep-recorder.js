import { getPlayerData, putPlayerData } from './lib/data-store';
import { FACTIONS } from './bin/self/aug/factions';
import { Timeline } from './lib/timeline';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const { factionRep = {}, passiveRepRate = {} } = getPlayerData(ns);

    const timelines = {};

    for (const faction of FACTIONS)
        timelines[faction] = new Timeline();

    while (true) {
        const now = Date.now();
        for (const faction of FACTIONS) {
            // Prevent double-counting
            if (ns.getPlayer().currentWorkFactionName === faction)
                continue;

            const timeline = timelines[faction];
            const curRep = ns.getFactionRep(faction);
            const rep60s = curRep - timeline.findValue(now - 60000);

            factionRep[faction] = curRep;

            if (rep60s > 0)
                passiveRepRate[faction] = rep60s/60;
        }

        putPlayerData(ns, { factionRep, passiveRepRate });
        await ns.sleep(200);
    }
}

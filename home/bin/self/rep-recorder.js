import { getPlayerData, putPlayerData } from '/lib/data-store';
import { FACTIONS } from '/bin/self/aug/factions';
import { Timeline } from '/lib/timeline';
import { table } from '/lib/table';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const { factionRep = {}, activeRepRate={}, passiveRepRate = {} } = getPlayerData(ns);

    const timelines = {};

    for (const faction of FACTIONS)
        timelines[faction] = new Timeline();

    while (true) {
        const now = Date.now();
        for (const faction of FACTIONS) {
            const curRep = ns.singularity.getFactionRep(faction);
            factionRep[faction] = curRep;

            // Prevent double-counting
            if (activeRepRate[faction] > 0) {
                const timeline = timelines[faction];
                timeline.addPoint(now, curRep);
                const rep60s = curRep - timeline.findValue(now - 60000);
                passiveRepRate[faction] = rep60s/60;
            }
        }

        const n = num => ns.formatNumber(num||0, 1);
        const tableData = FACTIONS.slice().sort().map(
            faction => [faction, n(passiveRepRate[faction]), n(activeRepRate[faction])]);
        ns.clearLog();
        ns.print(table(ns, ['FACTION', 'P REP', 'W REP'], tableData));

        putPlayerData(ns, { factionRep, passiveRepRate });
        await ns.sleep(200);
    }
}

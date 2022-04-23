import { PORT_GANG_DATA } from './etc/ports';
import { by } from './lib/util';
import Ports from './lib/ports';

const HEADINGS = {
    name: 'Name',
    baseRespect: 'R',
    baseWanted: 'W',
    baseMoney: '$',
    difficulty: 'Diff',
    hackWeight: 'hackW',
    strWeight: 'strW',
    defWeight: 'defW',
    dexWeight: 'dexW',
    agiWeight: 'agiW',
    chaWeight: 'chaW',
};

/** @param {NS} ns **/
export const printTaskTable = async (ns, sortColumnIndex) => {
    const content = Ports(ns).readPort(PORT_GANG_DATA);
    if (content === '')
        return ns.tprint('No data to show yet. Make sure gang.js has run');

    const propOrder = Object.keys(HEADINGS);
    const comparator = sortColumnIndex == null ? ()=>0 :  // Don't sort
        by(propOrder[sortColumnIndex]);              // Sort by column

    const tasks = content.tasks.sort(comparator);
    const rows = tasks.map((stats) => {
        const {
            baseMoney, baseRespect, baseWanted,
            difficulty, name,
            hackWeight, strWeight, defWeight, dexWeight, agiWeight, chaWeight,
        } = stats;
        const stat = s=>s||'-';
        return [
            name, baseRespect, baseWanted,
            ns.nFormat(baseMoney, '$0.00a'), difficulty,
            stat(hackWeight), stat(strWeight), stat(defWeight),
            stat(dexWeight), stat(agiWeight), stat(chaWeight),
        ].map(v=>v.toString());
    });

    const cw = Object.values(HEADINGS).map((heading, col) => { // Get column widths
        const cellWidths = [heading.length, ...rows.map(row=>row[col].length)];
        return cellWidths.reduce((a,b)=>a<b?b:a,0);
    });
    const pad = (content, i) => (i >= 4) ? content.padStart(cw[i]) : content.padEnd(cw[i]);
    let output = ['',
        Object.values(HEADINGS).map((heading,i)=>pad(heading, i)).join('  '),
        ...rows.map(cells => cells.map((cell,i)=>pad(cell, i)).join('  ')),
    ].join('\n');
    ns.tprint(output);
}

export async function main(ns) {
    await printTaskTable(ns, ns.args[0]);
}

import { getGangData } from '../../lib/data-store';

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

export const printTaskTable = async (ns: NS) => {
  const gangData = getGangData(ns);
  if (gangData == null || !gangData.isReady)
    return ns.tprint('No data to show yet. Make sure gang.js has run');

  const rows = ns.gang
    .getTaskNames()
    .map(ns.gang.getTaskStats)
    .map((stats) => {
      const {
        baseMoney,
        baseRespect,
        baseWanted,
        difficulty,
        name,
        hackWeight,
        strWeight,
        defWeight,
        dexWeight,
        agiWeight,
        chaWeight,
      } = stats;
      const stat = (s: number) => s || '-';
      return [
        name,
        baseRespect,
        baseWanted,
        '$' + ns.format.number(baseMoney, 2),
        difficulty,
        stat(hackWeight),
        stat(strWeight),
        stat(defWeight),
        stat(dexWeight),
        stat(agiWeight),
        stat(chaWeight),
      ].map((v) => v.toString());
    });

  const cw = Object.values(HEADINGS).map((heading, col) => {
    // Get column widths
    const cellWidths = [heading.length, ...rows.map((row) => row[col].length)];
    return cellWidths.reduce((a, b) => (a < b ? b : a), 0);
  });
  const pad = (content: string, i: number) =>
    i >= 4 ? content.padStart(cw[i]) : content.padEnd(cw[i]);
  let output = [
    '',
    Object.values(HEADINGS)
      .map((heading, i) => pad(heading, i))
      .join('  '),
    ...rows.map((cells) => cells.map((cell, i) => pad(cell, i)).join('  ')),
  ].join('\n');
  ns.tprint(output);
};

export async function main(ns: NS) {
  await printTaskTable(ns);
}

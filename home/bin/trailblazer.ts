import { getPath } from '../lib/backdoor.ts';
import { BRIGHT } from '../lib/colors';

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog('ALL');
  ns.ui.openTail();
  ns.ui.resizeTail(300, 300);

  while (true) {
    ns.clearLog();
    ns.print(` ${BRIGHT.BOLD('BACKDOOR HELPER')} \n`);
    const path = getPath(ns);
    if (path == null) {
      ns.print(' (no available servers) ');
    } else {
      const rows = [
        ...path.map((/** @type {string} */ s) =>
          s === 'home' ? ' home' : ` connect ${s} `,
        ),
        ' backdoor',
      ];
      while (rows.length < 15) {
        rows.push('');
      }
      ns.print(rows.join('\n'));
    }
    await ns.sleep(100);
  }
}

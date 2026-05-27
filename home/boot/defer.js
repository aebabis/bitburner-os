import { tprint } from './util';
import { GRAY } from '../lib/colors';

/** @param {NS} ns */
export const defer =
  (ns) =>
  async (/** @type {ScriptArg[]} */ ...args) => {
    tprint(ns)(GRAY + '  Deferring execution:        ' + ns.args.join(', '));
    const sent = args.map((s) =>
      typeof s === 'string' ? s : JSON.stringify(s),
    );
    await ns.sleep(50);
    ns.run('/boot/defer.js', 1, ...sent);
  };

/** @param {NS} ns */
export async function main(ns) {
  tprint(ns)(GRAY + '  Deferred execution resumed: ' + ns.args.join(', '));
  await ns.sleep(50);
  const [nextProgram, ...remainder] = ns.args;
  const nextProgramStr = /** @type {string} */ (nextProgram);
  let pid;
  if (nextProgramStr[0] === '[') {
    const [script, ...rest] = JSON.parse(nextProgramStr);
    pid = ns.run(script, 1, ...rest, ...remainder);
  } else {
    pid = ns.run(nextProgramStr, 1, ...remainder);
  }
  if (pid === 0) {
    ns.tprint('Skipping ' + nextProgram + ' because of RAM constraints');
    await defer(ns)(
      ...remainder.map((p) => JSON.parse(/** @type {string} */ (p))),
    );
  }
}

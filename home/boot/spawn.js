import { tprint } from './util';
import { GRAY } from '../lib/colors';

/** @param {NS} ns */
export const deferLite =
  (ns) =>
  (/** @type {ScriptArg[]} */ ...args) => {
    tprint(ns)(GRAY + '  Deferring execution:        ' + ns.args.join(', '));
    const [nextProgram, ...remainder] = args;
    ns.spawn(/** @type {string} */ (nextProgram), 1, ...remainder);
  };

/** @param {NS} ns */
export async function main(ns) {
  tprint(ns)(GRAY + '  Deferred execution resumed: ' + ns.args.join(', '));
  const [nextProgram, ...remainder] = ns.args;
  ns.spawn(
    /** @type {string} */ (nextProgram),
    { threads: 1, spawnDelay: 500 },
    ...remainder,
  );
}

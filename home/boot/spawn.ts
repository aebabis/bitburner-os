import { tprint } from './util';
import { GRAY } from '../lib/colors';

export const deferLite =
  (ns: NS) =>
  (/** @type {ScriptArg[]} */ ...args) => {
    tprint(ns)(GRAY + '  Deferring execution:        ' + ns.args.join(', '));
    const [nextProgram, ...remainder] = args;
    ns.spawn(/** @type {string} */ nextProgram, 1, ...remainder);
  };

export async function main(ns: NS) {
  tprint(ns)(GRAY + '  Deferred execution resumed: ' + ns.args.join(', '));
  const [nextProgram, ...remainder] = ns.args;
  ns.spawn(
    /** @type {string} */ nextProgram,
    { threads: 1, spawnDelay: 500 },
    ...remainder,
  );
}

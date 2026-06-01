import { tprint } from './util';
import { GRAY } from '../lib/colors';

export const defer =
  (ns: NS) =>
  async (...args: ScriptArg[]) => {
    tprint(ns)(GRAY + '  Deferring execution:        ' + ns.args.join(', '));
    const [script, ...rest] = args as string[];
    ns.spawn(script, { threads: 1, spawnDelay: 0 }, ...rest);
  };

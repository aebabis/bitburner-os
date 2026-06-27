import { getStaticData, putStaticData } from '../lib/data-store';
import { defer } from './defer';
import { tprint } from './util';
import { getCallGraph } from './call-graph';
import { STR } from '../lib/colors';

export async function main(ns: NS) {
  // Currently does nothing

  // Go to next step in the boot sequence
  await defer(ns)(...ns.args);
}

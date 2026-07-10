import { putPlayerData } from '../lib/data-store';
import { defer } from './defer';
import { tprint } from './util';
import { STR } from '../lib/colors';
import { makePlayerData } from '../lib/player-data';

export async function main(ns: NS) {
  tprint(ns)(STR.BOLD + 'INITIALIZING DYNAMIC PLAYER DATA');
  const player = ns.getPlayer();
  const primitives = makePlayerData(ns);
  for (const [name, has] of Object.entries(primitives)) tprint(ns)(STR + '  ' + name + ': ' + has);
  putPlayerData(ns, { player, ...primitives });

  // Go to next step in the boot sequence
  await defer(ns)(...ns.args);
}

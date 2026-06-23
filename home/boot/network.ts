import { defer } from './defer';
import { access } from '../bin/access';
import { infect } from '../bin/infect';
import { getHostnames } from '../lib/data-store';
import { tprint } from './util';
import { STR } from '../lib/colors';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  tprint(ns)(STR.BOLD + 'CONFIGURING NETWORK');

  const hostnames = getHostnames(ns);

  // Try to get more starting RAM
  tprint(ns)(STR + '  Hacking low-level servers');
  hostnames.forEach(access(ns));

  // Copy program files
  tprint(ns)(STR + '  Copying program files');
  for (const hostname of hostnames) {
    infect(ns, hostname);
  }

  // Go to next step in the boot sequence
  await defer(ns)(...ns.args);
}

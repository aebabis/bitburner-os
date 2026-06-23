import { nmap } from '../lib/nmap';
import { defer } from './defer';
import { putHostnames } from '../lib/data-store';
import { tprint } from './util';
import { STR } from '../lib/colors';

import { PORT_RUN_CONFIG, PORT_SERVICES_LIST } from '../etc/ports';
const PERSISTENT_PORTS = [PORT_RUN_CONFIG, PORT_SERVICES_LIST];

export async function main(ns: NS) {
  ns.disableLog('ALL');
  tprint(ns)(STR.BOLD + 'RESETTING PORTS AND SERVERS');

  // Clear all ports except configuration ports
  tprint(ns)(STR + '  Clearing ports');
  for (let i = 1; i <= 20; i++) if (!PERSISTENT_PORTS.includes(i)) ns.clearPort(i);

  // Generate list of hostnames
  tprint(ns)(STR + '  Mapping network');
  const hostnames = nmap(ns);
  putHostnames(ns, hostnames);

  // Erase old versions of files
  // Batchable files are copied later in boot sequence
  tprint(ns)(STR + '  Wiping old scripts');
  for (const hostname of hostnames)
    if (hostname !== 'home') for (const script of ns.ls(hostname, '.ts')) ns.rm(script, hostname);

  // Wipe tmp files
  tprint(ns)(STR + '  Wiping tmp/');
  for (const file of ns.ls('home')) if (file.startsWith('tmp')) ns.rm(file, 'home');

  // Go to next step in the boot sequence
  await defer(ns)(...ns.args);
}

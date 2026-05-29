import { nmap } from '../lib/nmap';
import { defer } from './defer';
import {
  putHostnames,
  putStaticData,
  putContractData,
} from '../lib/data-store';
import { tprint } from './util';
import { STR } from '../lib/colors';

import { PORT_RUN_CONFIG, PORT_SERVICES_LIST } from '../etc/ports';
const PERSISTENT_PORTS = [PORT_RUN_CONFIG, PORT_SERVICES_LIST];

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog('ALL');
  tprint(ns)(STR.BOLD + 'RESETTING PORTS AND SERVERS');

  // Clear all ports except configuration ports
  tprint(ns)(STR + '  Clearing ports');
  for (let i = 1; i <= 20; i++)
    if (!PERSISTENT_PORTS.includes(i)) ns.clearPort(i);

  // Generate list of hostnames
  tprint(ns)(STR + '  Mapping network');
  const hostnames = nmap(ns);
  putHostnames(ns, hostnames);

  // Erase old versions of files, then upload
  // the batchable files to every server
  tprint(ns)(STR + '  Wiping old scripts');
  for (const hostname of hostnames) {
    if (hostname !== 'home') {
      const scripts = ns.ls(hostname, '.ts');
      for (const script of scripts) {
        ns.rm(script, hostname);
      }
    }
  }

  tprint(ns)(STR + '  Cataloging all local scripts');

  tprint(ns)(STR + '  Cataloging coding contracts');
  const contracts = hostnames
    .map((hostname) => {
      const ccts = ns.ls(hostname).filter((f) => f.endsWith('.cct'));
      return ccts.map((filename) => ({ filename, hostname }));
    })
    .flat();

  putContractData(ns, { contracts });

  // Go to next step in the boot sequence
  await defer(ns)(...ns.args);
}

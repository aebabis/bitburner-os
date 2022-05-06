import { nmap } from './lib/nmap';
import { defer } from './boot/defer';
import { putHostnames, putStaticData } from './lib/data-store';

import { PORT_RUN_CONFIG, PORT_SERVICES_LIST } from './etc/ports';
const PERSISTENT_PORTS = [PORT_RUN_CONFIG, PORT_SERVICES_LIST];

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    // Clear all ports except configuration ports
    ns.tprint('Clearing ports');
    for (let i = 1; i <= 20; i++)
        if (!PERSISTENT_PORTS.includes(i))
            ns.clearPort(i);

    // Generate list of hostnames
    ns.tprint('Mapping network');
    const hostnames = nmap(ns);
    putHostnames(ns, hostnames);

    // Erase old versions of files, then upload
    // the batchable files to every server
    ns.tprint('Wiping old scripts');
    for (const hostname of nmap(ns)) {
        if (hostname !== 'home') {
            const scripts = ns.ls(hostname, '.js');
            for (const script of scripts) {
                ns.rm(script, hostname);
            }
        }
    }

    ns.tprint('Cataloging all local scripts');
    const scripts = ns.ls('home').filter(s=>s.endsWith('.js'));
    putStaticData(ns, { scripts });

    // Go to next step in the boot sequence
	defer(ns)(...ns.args);
}
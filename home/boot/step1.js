import { WEAKEN, GROW, HACK, INFECT, SHARE } from './etc/filenames';
import { THREADPOOL } from './etc/config';
import { saveHostnames, nmap  } from './lib/nmap';
import { by } from './lib/util';
import { defer } from './boot/defer';
import { fullInfect } from './bin/infect';

import { PORT_RUN_CONFIG, PORT_SERVICES_LIST } from './etc/ports';
const PERSISTENT_PORTS = [PORT_RUN_CONFIG, PORT_SERVICES_LIST];

const canRunCode = (ns) => (hostname) => ns.getServerMaxRam(hostname) >= 1.6;

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
    saveHostnames(ns);
    const hostnames = nmap(ns);

    // Erase old versions of files, then upload
    // the batchable files to every server
    ns.tprint('Updating remote files');
    for (const hostname of hostnames) {
        if (hostname !== 'home' && canRunCode(ns)(hostname)) {
            ns.ls(hostname, '.js').forEach(filename => ns.rm(filename, hostname));
            await ns.scp([HACK, GROW, WEAKEN, INFECT, SHARE], hostname);
        }
    }

    // To reduce the size of the game save file,
    // only put the non-batch code on the first
    // N servers. This amount can be adjusted as needed.
    const SERVERS_NEEDED = 10;
    const zombies = hostnames
        .filter(hostname => hostname !== 'home')
        .filter(hostname => !hostname.startsWith(THREADPOOL))
        .filter(canRunCode(ns))
        .sort(by(ns.getServerRequiredHackingLevel))
        .slice(0, SERVERS_NEEDED);
    ns.tprint('Infecting zombies: ' + zombies.join(', '));
    await fullInfect(ns, ...zombies);
    try { await fullInfect(ns, 'THREADPOOL-1'); } catch {}

    // Go to next step in the boot sequence
	defer(ns)(...ns.args);
}
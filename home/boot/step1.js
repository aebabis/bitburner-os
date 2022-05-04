import { WEAKEN, GROW, HACK, INFECT, SHARE } from './etc/filenames';
import { THREADPOOL } from './etc/config';
import { saveHostnames, nmap  } from './lib/nmap';
import { by } from './lib/util';
import { defer } from './boot/defer';

import { PORT_RUN_CONFIG, PORT_SERVICES_LIST } from './etc/ports';
const PERSISTENT_PORTS = [PORT_RUN_CONFIG, PORT_SERVICES_LIST];

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    ns.tprint('Clearing ports');

    // Clear all ports except configuration ports
    for (let i = 1; i <= 20; i++)
        if (!PERSISTENT_PORTS.includes(i))
            ns.clearPort(i);

    ns.tprint('Mapping network');

    // Generate list of hostnames
    saveHostnames(ns);
    const hostnames = nmap(ns);

    ns.tprint('Updating remote files');

    for (const hostname of hostnames) {
        if (hostname !== 'home') {
            ns.ls(hostname).forEach(filename => ns.rm(filename, hostname));
            await ns.scp([HACK, GROW, WEAKEN, INFECT, SHARE], hostname);
        }
    }

    // To reduce the size of the game save file,
    // only put the non-batch code on the first
    // N servers. This amount can be adjusted as needed.
    const SERVERS_NEEDED = 10;
    const JS = ns.ls('home', '.js');
    const zombies = hostnames
        .filter(hostname => hostname !== 'home')
        .filter(hostname => !hostname.startsWith(THREADPOOL))
        .filter(hostname => ns.getServerMaxRam(hostname) >= 1.6)
        .sort(by(ns.getServerRequiredHackingLevel))
        .slice(0, SERVERS_NEEDED);
    ns.tprint('Infecting zombies: ' + zombies.join(', '));
    for (const hostname of zombies)
        await ns.scp(JS, 'home', hostname);

    // Go to next step in the boot sequence
	defer(ns)(...ns.args);
}
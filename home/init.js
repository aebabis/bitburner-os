import { SCH_TMP_DIR } from './etc/config';
import { HOSTSFILE, SHARE_FILE, BROKER_FILE } from './etc/filenames';
import { nmap } from './lib/nmap';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    ns.rm(HOSTSFILE);
    await ns.write(SHARE_FILE,  0,    'w');  // No faction, no share
    await ns.write(BROKER_FILE, 1e10, 'w');

    // Generate list of hostnames
    ns.exec('/lib/nmap.js', 'home');
    while (await ns.read(HOSTSFILE) === '')
        await ns.sleep(50);
    const hostnames = (await ns.read(HOSTSFILE)).split(',');

    // Copy any possible dependencies for remote processes
    for (const hostname of hostnames){
        const rootJS = ns.ls('home', '.js').filter(name=>!name.includes('/'));
        await ns.scp(rootJS,                'home', hostname);
        await ns.scp(ns.ls('home', 'etc/'), 'home', hostname);
        await ns.scp(ns.ls('home', 'lib/'), 'home', hostname);
        await ns.scp(ns.ls('home', 'bin/'), 'home', hostname);
    }

	// Since we're restarting, clear queued jobs.
    nmap(ns).forEach((hostname) => {
        ns.ls(hostname, SCH_TMP_DIR).forEach(filename=>ns.rm(filename, hostname));
    });

    // Clear all ports
    for (let i = 1; i <= 20; i++)
        ns.clearPort(i);

    ns.tprint('Starting scheduler');
	ns.exec('scheduler.js', 'home');
    ns.exec('planner.js', 'home');
}
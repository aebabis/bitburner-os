import { HOSTSFILE, SHARE_FILE, BROKER_FILE, STATIC_DATA } from './etc/filenames';
import { writeHostsfile } from './lib/nmap';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    await ns.write(SHARE_FILE,  0,    'w');  // No faction, no share
    await ns.write(BROKER_FILE, 1e10, 'w');

    // Generate list of hostnames
    await writeHostsfile(ns);
    const hostnames = (await ns.read(HOSTSFILE)).split(',');

    // Copy any possible dependencies for remote processes
    for (const hostname of hostnames){
        const rootJS = ns.ls('home', '.js').filter(name=>!name.includes('/'));
        await ns.scp(rootJS,                'home', hostname);
        await ns.scp(ns.ls('home', 'etc/'), 'home', hostname);
        await ns.scp(ns.ls('home', 'lib/'), 'home', hostname);
        await ns.scp(ns.ls('home', 'bin/'), 'home', hostname);
    }

    // Clear all ports
    for (let i = 1; i <= 20; i++)
        ns.clearPort(i);
    
    await ns.write(STATIC_DATA, JSON.stringify({
		purchasedServerMaxRam: ns.getPurchasedServerMaxRam(),
		purchasedServerLimit: ns.getPurchasedServerLimit(),
    }, null, 2), 'w');

    ns.tprint('Starting scheduler');
	ns.exec('scheduler.js', 'home');
}
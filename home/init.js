import {
    HOSTSFILE,
    BROKER_FILE,
    STATIC_DATA,
    THIEF,
    WEAKEN,
    GROW,
    HACK,
} from './etc/filenames';
import { writeHostsfile } from './lib/nmap';
import getConfig from './lib/config';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    getConfig(ns).set('share', 0);    // No faction, no share
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
        thiefScriptRam: ns.getScriptRam(THIEF),
        weakenScriptRam: ns.getScriptRam(WEAKEN),
        growScriptRam: ns.getScriptRam(GROW),
        hackScriptRam: ns.getScriptRam(HACK),
		purchasedServerMaxRam: ns.getPurchasedServerMaxRam(),
		purchasedServerLimit: ns.getPurchasedServerLimit(),
        // hacknetProductionMultiplier: ns.getHacknetMultipliers().production(),
    }, null, 2), 'w');

    ns.tprint('Starting scheduler');
	ns.exec('/bin/scheduler.js', 'home', 1, 'bootstrap');
}
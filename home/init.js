import { HOSTSFILE, SHARE_FILE, BROKER_FILE } from './etc/filenames';
import { delegate, delegateAny } from './lib/scheduler-delegate.js';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    const startAt = async (script, hostname, ...args) => {
        try {
            await delegate(ns, true)(script, hostname, 1, ...args);
            ns.tprint(script);
        } catch (error) {
            ns.tprint(error);
        }
    };

    const startAny = async (script, ...args) => {
        try {
            await delegateAny(ns, true)(script, 1, ...args);
            ns.tprint(script);
        } catch (error) {
            ns.tprint(error);
        }
    };

    const start = async (script, ...args) => startAt(script, 'home', ...args);


    await ns.write(SHARE_FILE,  0,    'w');  // No faction, no share
    await ns.write(BROKER_FILE, 1e10, 'w');

    // Clear all ports
    for (let i = 1; i <= 20; i++)
        ns.clearPort(i);

    ns.exec('/bin/nmap.js', 'home');
	ns.exec('scheduler.js', 'home', 1);
    ns.tprint('scheduler.js');
    ns.tail('scheduler.js');

    const hostnames = (await ns.read(HOSTSFILE)).split(',');
    // nmap(ns).forEach((hostname) => {
    //     if (hostname === 'home')
    //         return;
    //     ns.ls(hostname, '.js').forEach(filename=>ns.rm(filename, hostname));
    //     ns.ls(hostname, '.txt').forEach(filename=>ns.rm(filename, hostname));
    // })
    for (const hostname of hostnames){
        const rootJS = ns.ls('home', '.js').filter(name=>!name.includes('/'));
        // await ns.scp('logger.js',           'home', hostname);
        // await ns.scp('/bin/infect.js',      'home', hostname);
        await ns.scp(rootJS,                'home', hostname);
        await ns.scp(ns.ls('home', 'etc/'), 'home', hostname);
        await ns.scp(ns.ls('home', 'lib/'), 'home', hostname);
        await ns.scp(ns.ls('home', 'bin/'), 'home', hostname);
    }
    
	await start('logger.js');
    await start('access.js');
	await startAt('ringleader.js', 'foodnstuff');
    await startAny('hacknet.js');
    await startAny('gang.js', 'service');
	await startAny('assistant.js', 'service');
    await startAny('servers.js', 'service');
	// await startAny('share.js');
	// await startAny('broker.js');
	await startAny('money.js', 'thief.js');

    ns.tprint('init complete');
    ns.tprint('-'.repeat(20));
}
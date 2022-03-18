import { SHARE_FILE, BROKER_FILE } from './etc/filenames';
import { exec, execAnyHost } from './lib/scheduler-api.js';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    const copyJS = async (destination) => {
        const JS_FILES = ns.ls('home').filter(f=>f.endsWith('.js'));
        const TXT_FILES = ns.ls('home').filter(f=>f.endsWith('.txt'));
        await ns.scp(JS_FILES, 'home', destination);
        await ns.scp(TXT_FILES, 'home', destination);
    }

    const startAt = async (script, hostname, ...args) => {
        try {
            await exec(ns)(script, hostname, 1, ...args);
            ns.tprint(script);
        } catch (error) {
            ns.tprint(error);
        }
    };

    const startAny = async (script, ...args) => {
        try {
            await execAnyHost(ns, copyJS)(script, 1, ...args);
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

    ns.exec('nmap.js', 'home');
	ns.exec('scheduler.js', 'home', 1);
    ns.tprint('scheduler.js');
    ns.tail('scheduler.js');
    
	await start('logger.js');
    await start('access.js');
    await start('gang-controller.js');
	await startAt('ringleader.js', 'foodnstuff');
    await startAny('hacknet.js');
	await startAny('assistant.js', 'service');
    await startAny('servers.js', 'service');
	// await startAny('share.js');
	// await startAny('broker.js');
	await startAny('money.js', 'ringleader.js');

    ns.tprint('init complete');
    ns.tprint('-'.repeat(20));
}
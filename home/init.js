import { THIEF_HOME } from './etc/config';
import { exec } from './lib/scheduler-api.js';

/** @param {NS} ns **/
export async function main(ns) {
    ns.exec('nmap.js', 'home');
	ns.exec('scheduler.js', 'home', 1);
    ns.tprint('scheduler.js');

    const startAt = async (script, hostname, ...args) => {
        try {
            await exec(ns)(script, hostname, 1, ...args);
            ns.tprint(script);
        } catch (error) {
            ns.tprint(error);
        }
    };

    const start = async (script, ...args) => startAt(script, 'home', ...args);

	await start('logger.js');
    await start('access.js');
    if (ns.getServerMaxRam('home') >= 64) {
        await ns.sleep(50);
        ns.exec('infect.js', 'home', 1, THIEF_HOME);
	    await startAt('ringleader.js', THIEF_HOME);
	    await start('money.js', 'ringleader.js');
    } else {
        await startAt('thief.js', THIEF_HOME, 'n00dles');
    }
    await start('hacknet.js');
	await start('assistant.js', 'service');
    await start('servers.js');
	await start('share.js', 0); // No faction, no share
	await start('share.js');
	await start('broker.js', 'reserve', 1e10);
	await start('broker.js');

    ns.tprint('init complete');
    ns.tprint('-'.repeat(20));
}
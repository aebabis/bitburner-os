import { exec } from './scheduler.js';

/** @param {NS} ns **/
export async function main(ns) {
    ns.exec('nmap.js');
	ns.exec('scheduler.js', 'home', 1);
    ns.tprint('scheduler.js');

    const start = async (script, ...args) => {
        await exec(ns)(script, 'home', 1, ...args);
        ns.tprint(script);
    };

    await start('scheduler.js', 'cleaner');
    await start('access.js');
    await start('servers.js');
    await start('hacknet.js');
	await start('thief-2.0.js');
	await start('logger.js');
	await start('backdoor-assistant.js', 'daemon');
	await start('backdoor-assistant.js', 'monitor');
	await start('money.js', 'thief-2.0.js');
	await start('share.js', 0); // No faction, no share
	await start('share.js');
	await start('broker.js', 'reserve', 1e10);
	await start('broker.js');

    ns.tprint('init complete');
    ns.tprint('-'.repeat(20));
}
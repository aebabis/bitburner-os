import { HOSTSFILE, THIEF, WEAKEN, GROW, HACK } from './etc/filenames';
import { delegateAny } from './lib/scheduler-delegate';
import { by, waitToRead } from './lib/util';
import { logger } from './logger';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    const console = logger(ns);

    const procs = {};
    const getThief = target => {
        if (typeof target !== 'string')
            throw new Error('Thief target must be a hostname');
        const proc= procs[target];
        if (proc == null)
            return null;
        return ns.getRunningScript(proc.pid) ||
            ns.getRunningScript(THIEF, proc.hostname, target) ||
            (procs[target] = null);
    }

    const hostnames = (await waitToRead(ns)(HOSTSFILE)).split(',');
    
    // const copyDeps = async ({hostname}) => {
    //     if (hostname === 'home')
    //         return;
    //     // await ns.scp('logger.js', 'home', target);
    //     // await ns.scp(ns.ls('home', 'etc/'), 'home', target);
    //     // await ns.scp(ns.ls('home', 'lib/'), 'home', target);
    //     // await ns.scp(ns.ls('home', 'bin/'), 'home', target);
    //     await ns.scp([THIEF, WEAKEN, GROW, HACK], 'home', hostname);
    // }
    
    while(true) {
        try {
            ns.clearLog();

            const hackingLevel = ns.getHackingLevel();
            // const freeRam = hostnames
            //     .map(ns.getServer)
            //     .filter(server=>server.hasAdminRights)
            //     .map(({ ramUsed, maxRam }) => maxRam - (ramUsed||0))
            //     .reduce((a, b) => a + b, 0);
            const expectedValue = ({ hostname, moneyMax }) => ns.hackAnalyzeChance(hostname) * moneyMax;
            const canHack = ({ requiredHackingSkill, hasAdminRights }) =>
                hasAdminRights && requiredHackingSkill <= hackingLevel;

            // ns.print(freeRam);
            const servers = hostnames.map(ns.getServer)
                .filter(s=>!s.purchasedByPlayer)
                .filter(canHack)
                .filter(server => getThief(server.hostname) == null)
                .filter(server => expectedValue(server) > 0)
                .sort(by(expectedValue));
            ns.print(`${servers.length} eligible servers:`);
            ns.print(servers.map(s=>s.hostname.padEnd(20) + ' ' + s.requiredHackingSkill).join('\n'));
            if (servers.length > 0) {
                const { hostname } = servers[0];
                const handle = await delegateAny(ns, true)(THIEF, 1, hostname);
                // logger(ns).log(handle);
                procs[hostname] = handle;
            }
        } catch (error) {
            await logger(ns)(error);
            await console.error(error);
        }
        await ns.sleep(1000);
    }
}
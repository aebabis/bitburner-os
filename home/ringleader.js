import { HOSTSFILE, THIEF, WEAKEN, GROW, HACK } from './etc/filenames';
import { execAnyHost } from './lib/scheduler-api';
import { by, write, waitToRead } from './lib/util';
import { logger } from './logger';
import { nmap } from './nmap';

const WEAKEN_SRC = `export async function main(ns) {
    const target = ns.args[0];
    await ns.weaken(target);
}`;
const GROW_SRC = `export async function main(ns) {
    const target = ns.args[0];
    await ns.grow(target);
}`;
const HACK_SRC = `export async function main(ns) {
    const target = ns.args[0];
    await await ns.hack(target);
}`;

export const copyDeps = async (ns, target) => {
    if (target === 'home')
        return;
    ns.print('Copying Dependencies to ' + target);
    await ns.scp('logger.js', 'home', target);
    await ns.scp(ns.ls('home', 'etc/'), 'home', target);
    await ns.scp(ns.ls('home', 'lib/'), 'home', target);
    await ns.scp(ns.ls('home', 'bin/'), 'home', target);
    await ns.scp([THIEF, WEAKEN, GROW, HACK], 'home', target);
}

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

    await write(ns)(WEAKEN, WEAKEN_SRC, 'w');
    await write(ns)(GROW, GROW_SRC, 'w');
    await write(ns)(HACK, HACK_SRC, 'w');
    while(true) {
        try {
            ns.clearLog();

            const hackingLevel = ns.getHackingLevel();
            const freeRam = nmap(ns)
                .map(ns.getServer)
                .filter(server=>server.backdoorInstalled)
                .map(({ ramUsed, maxRam }) => maxRam - ramUsed)
                .reduce((a, b) => a + b, 0);
            const expectedValue = ({ hostname, moneyMax }) => ns.hackAnalyzeChance(hostname) * moneyMax;
            const canHack = ({ requiredHackingSkill, hasAdminRights }) =>
                hasAdminRights && requiredHackingSkill <= hackingLevel;

            ns.print(freeRam);
            if (freeRam >= ns.getScriptRam(WEAKEN) * 100) {
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
                    ns.print('ATTEMPTING TO SPAWN ' + THIEF + ' ' + 1 + ' ' + hostname);
                    const handle = await execAnyHost(ns, async (env) => {
                        return copyDeps(ns, env);
                    })(THIEF, 1, hostname);
                    ns.print('SUCCESS: ' + JSON.stringify(handle));
                    procs[hostname] = handle;
                }
            } else {
                ns.print('No available ram to steal with');
            }
        } catch (error) {
            ns.print(error);
            await console.error(error);
        }
        await ns.sleep(1000);
    }
}
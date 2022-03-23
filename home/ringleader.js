import { THREADPOOL_NAME } from './etc/config';
import { HOSTSFILE, THIEF } from './etc/filenames';
import { PORT_SCH_RAM_DATA, PORT_RL_TO_THIEVES, PORT_THIEVES_TO_RL } from './etc/ports';
import Ports from './lib/ports';
import { getReports } from './lib/thief-port';
import { delegateAny } from './lib/scheduler-delegate';
import { by, waitToRead } from './lib/util';
import { logger } from './logger';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    const console = logger(ns);

    const procs = {};
    const hasThief = target => {
        if (typeof target !== 'string')
            throw new Error('Thief target must be a hostname');
        const proc= procs[target];
        if (proc == null)
            return false;
        return ns.getRunningScript(proc.pid) != null;
    }

    const hostnames = (await waitToRead(ns)(HOSTSFILE)).split(',');
    const possibleTargets = hostnames.filter(hostname => hostname !== 'home' &&
        !hostname.startsWith(THREADPOOL_NAME));
    
    // const copyDeps = async (hostname) => {
    //     if (hostname === 'home')
    //         return;
    //     await ns.scp([THIEF, WEAKEN, GROW, HACK], 'home', hostname);
    // }
    
    while(true) {
        try {
            ns.clearLog();
            
            const port = Ports(ns).getPortHandle(PORT_SCH_RAM_DATA);
            const ramData = port.peek();
            if (ramData == null)
                continue;
            if (ramData.totalRamAvailable < 10 * 1.75)
                continue;

            const expectedValue = ({ hackChance, moneyMax }) => hackChance * moneyMax;
            const canHack = ({ requiredHackingSkill, hasAdminRights }) =>
                hasAdminRights && requiredHackingSkill <= hackingLevel;

            const hackingLevel = ns.getHackingLevel();
            const validTargets = possibleTargets
                .map((hostname) => ({
                    hostname,
                    requiredHackingSkill: ns.getServerRequiredHackingLevel(hostname),
                    hasAdminRights: ns.hasRootAccess(hostname),
                    moneyMax: ns.getServerMaxMoney(hostname),
                    hackChance: ns.hackAnalyzeChance(hostname),
                })).filter(canHack)
                .filter(server => expectedValue(server) > 0)
                .sort(by(server => /*-*/expectedValue(server)));

            const currentTargets = validTargets.filter(({hostname})=>hasThief(hostname));
            const newTargets = validTargets.filter(({hostname})=>!hasThief(hostname));
            const toString = ({ hostname, moneyMax, hackChance }) =>
                hostname.padEnd(20) + ' ' +
                hackChance.toFixed(3) + ' ' +
                ns.nFormat(moneyMax, '0.000a') + ' expected=' +
                ns.nFormat(hackChance * moneyMax, '0.000a');
            
            const reports = getReports(ns);

            ns.print('CURRENT TARGETS');
            currentTargets.forEach(server => ns.print(toString(server)));
            ns.print('\nPOSSIBLE TARGETS');
            newTargets.forEach(server => ns.print(toString(server)));

            // ns.print(freeRam);
            if (validTargets.length > 0) {
                const { hostname } = validTargets[0];
                const handle = await delegateAny(ns, true)(THIEF, 1, hostname);
                // logger(ns).log(handle);
                procs[hostname] = handle;
            }
        } catch (error) {
            await console.error(error);
        } finally {
            await ns.sleep(1000);
        }
    }
}
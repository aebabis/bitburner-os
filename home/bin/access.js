import { INFECT } from '../etc/filenames';
import { delegateAny } from '../lib/scheduler-delegate';
import { getHostnames } from '../lib/data-store';
// import { disableService } from './lib/service-api';

/** @param {NS} ns **/
export const access = (ns) => async (target) => {
    if (ns.fileExists("BruteSSH.exe", "home"))  ns.brutessh(target);
    if (ns.fileExists("FTPCrack.exe", "home"))  ns.ftpcrack(target);
    if (ns.fileExists("relaySMTP.exe", "home")) ns.relaysmtp(target);
    if (ns.fileExists("HTTPWorm.exe", "home"))  ns.httpworm(target);
    if (ns.fileExists("SQLInject.exe", "home")) ns.sqlinject(target);

    try {
        ns.nuke(target);
        return true;
    } catch {
        return false;
    }
};

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    if (ns.args[0] != null) {
        return access(ns.args[0]);
    }

    let hostnames = getHostnames(ns)
        .filter(hostname=>!ns.hasRootAccess(hostname));

    while (hostnames.length > 0) {
        const startingLength = hostnames.length;
        const unvisited = hostnames;
        hostnames = [];
        let hostname;
        let success;
        while (hostname = unvisited.shift())
            if (await access(ns)(hostname)) {
                success = true;
                await delegateAny(ns)(INFECT, 1, hostname);
            } else {
                hostnames.push(hostname);
            }
        if (success)
            ns.print(`Hacked ${startingLength - hostnames.length} servers. ${hostnames.length} remaining`);
        await ns.sleep(1000);
    }
}

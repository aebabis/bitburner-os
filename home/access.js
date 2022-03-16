import { HOSTSFILE } from './etc/filenames';
import { waitToRead } from './lib/util';

/** @param {NS} ns **/
export const access = (ns) => async (target) => {
    if (ns.fileExists("BruteSSH.exe", "home")) {
        ns.brutessh(target);
    }
    if (ns.fileExists("FTPCrack.exe", "home")) {
        ns.ftpcrack(target);
    }
    if ( ns.fileExists("relaySMTP.exe", "home")) {
        ns.relaysmtp(target);
    }
    if ( ns.fileExists("HTTPWorm.exe", "home")) {
        ns.httpworm(target);
    }
    if (ns.fileExists("SQLInject.exe", "home")) {
        ns.sqlinject(target);
    }
    try {
        ns.nuke(target);
        return true;
    } catch {
        return false;
    }
    // await ns['installBackdoor'](target);
}

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    if (ns.args[0] != null) {
        return access(ns.args[0]);
    }

    let hostnames = (await waitToRead(ns)(HOSTSFILE)).split(',');

    while (hostnames.length > 0) {
        const startingLength = hostnames.length;
        const unvisited = hostnames;
        hostnames = [];
        let hostname;
        let success;
        while (hostname = unvisited.shift())
            if (await access(ns)(hostname))
                success = true;
            else
                hostnames.push(hostname);
        if (success)
            ns.print(`Hacked ${startingLength - hostnames.length} servers. ${hostnames.length} remaining`);
        await ns.sleep(1000);
    }
}
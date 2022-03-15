import { FILES } from './etc/filenames';

/** @param {NS} ns **/
export const access = (ns) => async (target) => {
    const {
        openPortCount,
        numOpenPortsRequired,
        sshPortOpen,
        ftpPortOpen,
        smtpPortOpen,
        httpPortOpen,
        sqlPortOpen,
        hasAdminRights,
    } = ns.getServer(target);

    if (!sshPortOpen && ns.fileExists("BruteSSH.exe", "home")) {
        ns.brutessh(target);
    }
    if (!ftpPortOpen && ns.fileExists("FTPCrack.exe", "home")) {
        ns.ftpcrack(target);
    }
    if (!smtpPortOpen && ns.fileExists("relaySMTP.exe", "home")) {
        ns.relaysmtp(target);
    }
    if (!httpPortOpen && ns.fileExists("HTTPWorm.exe", "home")) {
        ns.httpworm(target);
    }
    if (!sqlPortOpen && ns.fileExists("SQLInject.exe", "home")) {
        ns.sqlinject(target);
    }
    if (!hasAdminRights && openPortCount >= numOpenPortsRequired)
        ns.nuke(target);
}

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    if (ns.args[0] != null) {
        return access(ns.args[0]);
    }
    const hostnames = (await (ns.read(FILES.HOSTS)).split(','));
    while (hostnames.length > 0) {
        for (const hostname of hostnames) {
            await access(ns)(hostname);
        }
        await ns.sleep(1000);
    }
}

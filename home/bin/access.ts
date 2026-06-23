import { INFECT } from '../etc/filenames';
import { delegateAny } from '../lib/scheduler-delegate';
import { getHostnames } from '../lib/data-store';

export const access = (ns: NS) => (target: string) => {
  if (ns.fileExists('BruteSSH.exe', 'home')) ns.brutessh(target);
  if (ns.fileExists('FTPCrack.exe', 'home')) ns.ftpcrack(target);
  if (ns.fileExists('relaySMTP.exe', 'home')) ns.relaysmtp(target);
  if (ns.fileExists('HTTPWorm.exe', 'home')) ns.httpworm(target);
  if (ns.fileExists('SQLInject.exe', 'home')) ns.sqlinject(target);
  return ns.nuke(target);
};

export async function main(ns: NS) {
  if (ns.args[0] != null) {
    if (typeof ns.args[0] !== 'string')
      throw new Error('Param if given, must be string. Got: ' + ns.args[0]);
    return access(ns)(ns.args[0]);
  }

  let hostnames = getHostnames(ns).filter((hostname) => !ns.hasRootAccess(hostname));

  while (hostnames.length > 0) {
    const startingLength = hostnames.length;
    const unvisited = hostnames;
    hostnames = [];
    let hostname;
    let success;
    while ((hostname = unvisited.shift()))
      if (access(ns)(hostname)) {
        success = true;
        if (ns.getServerMaxRam(hostname) > 0) {
          await delegateAny(ns)(INFECT, 1, hostname);
        }
      } else {
        hostnames.push(hostname);
      }
    if (success)
      ns.print(
        `Hacked ${startingLength - hostnames.length} servers. ${hostnames.length} remaining`,
      );
    await ns.sleep(1000);
  }
}

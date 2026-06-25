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
  ns.disableLog('ALL');
  if (ns.args[0] != null) {
    if (typeof ns.args[0] !== 'string')
      throw new Error('Param if given, must be string. Got: ' + ns.args[0]);
    return access(ns)(ns.args[0]);
  }

  let hostnames = getHostnames(ns);

  while (hostnames.length > 0) {
    const unvisited = hostnames;
    hostnames = [];
    let hostname;
    while ((hostname = unvisited.shift()))
      if (access(ns)(hostname)) {
        ns.print(`Hacked ${hostname}. (${hostnames.length} servers remain})`);
      } else {
        hostnames.push(hostname);
      }
    await ns.sleep(1000);
  }
}

import { getHostnames } from '../../lib/data-store';
import { disableService } from '../../lib/service-api';

const getNeededPortLevel = (ns: NS) => {
  const isHackable = (hostname: string) =>
    ns.getServerRequiredHackingLevel(hostname) <= ns.getHackingLevel();
  return Math.max(
    ...getHostnames(ns)
      .filter((hostname) => hostname !== 'home')
      .filter(isHackable)
      .map(ns.getServerNumPortsRequired),
  );
};

export async function main(ns: NS) {
  ns.disableLog('ALL');
  if (ns.singularity.purchaseTor()) {
    // Port programs are not purchased until they're
    // required for a server the player can hack
    const portLevel = getNeededPortLevel(ns);
    if (
      ns.singularity.purchaseProgram('Formulas.exe') &&
      portLevel >= 1 &&
      ns.singularity.purchaseProgram('BruteSSH.exe') &&
      portLevel >= 2 &&
      ns.singularity.purchaseProgram('FTPCrack.exe') &&
      portLevel >= 3 &&
      ns.singularity.purchaseProgram('relaySMTP.exe') &&
      portLevel >= 4 &&
      ns.singularity.purchaseProgram('HTTPWorm.exe') &&
      portLevel >= 5 &&
      ns.singularity.purchaseProgram('SQLInject.exe')
    ) {
      disableService(ns, 'tor');
    }
  }
}

import { disableService } from '../../lib/service-api';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  if (ns.singularity.purchaseTor()) {
    if (
      ns.singularity.purchaseProgram('BruteSSH.exe') &&
      ns.singularity.purchaseProgram('FTPCrack.exe') &&
      ns.singularity.purchaseProgram('relaySMTP.exe') &&
      ns.singularity.purchaseProgram('HTTPWorm.exe') &&
      ns.singularity.purchaseProgram('SQLInject.exe') &&
      ns.singularity.purchaseProgram('Formulas.exe')
    ) {
      disableService(ns, 'tor');
    }
  }
}

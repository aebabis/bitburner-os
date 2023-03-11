import { disableService } from './lib/service-api';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    if (ns.singularity.purchaseTor()) {
        if (ns.singularity.purchaseProgram("brutessh.exe")  &&
            ns.singularity.purchaseProgram("ftpcrack.exe")  &&
            ns.singularity.purchaseProgram("relaysmtp.exe") &&
            ns.singularity.purchaseProgram("httpworm.exe")  &&
            ns.singularity.purchaseProgram("sqlinject.exe")
        ) {
            disableService(ns, 'tor');
        }
    }
}
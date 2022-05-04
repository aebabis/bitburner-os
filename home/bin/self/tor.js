import { disableService } from './lib/service-api';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    if (ns.purchaseTor()) {
        if (ns.purchaseProgram("brutessh.exe")  &&
            ns.purchaseProgram("ftpcrack.exe")  &&
            ns.purchaseProgram("relaysmtp.exe") &&
            ns.purchaseProgram("httpworm.exe")  &&
            ns.purchaseProgram("sqlinject.exe")
        ) {
            disableService(ns, 'tor');
        }
    }
}
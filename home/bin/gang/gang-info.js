import { GANG_DATA, GANG_CACHE } from './etc/filenames';

/** @param {NS} ns **/
export async function main(ns) {
    const inGang = ns.gang.inGang();
    if (inGang) {
        const data = JSON.stringify(ns.gang.getGangInformation());
        await ns.write(GANG_CACHE, data);
    }
}
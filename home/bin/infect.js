import { HACK, GROW, WEAKEN } from './etc/filenames';

/** @param {NS} ns **/
export const infect = async (ns, ...hostnames) => {
    for (const hostname of hostnames){
        await ns.scp([HACK, GROW, WEAKEN], 'home', hostname);
    }
}

/** @param {NS} ns **/
export async function main (ns) {
    return infect(ns, ...ns.args);
}
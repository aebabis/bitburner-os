import { HACK, GROW, WEAKEN, SHARE } from './etc/filenames';

/** @param {NS} ns **/
export const infect = async (ns, ...hostnames) => {
    for (const hostname of hostnames){
        await ns.scp([HACK, GROW, WEAKEN, SHARE], 'home', hostname);
    }
}

/** @param {NS} ns **/
export async function main (ns) {
    return infect(ns, ...ns.args);
}
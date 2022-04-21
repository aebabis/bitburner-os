import { nmap } from './lib/nmap';

/** @param {NS} ns **/
export async function main(ns) {
    nmap(ns).forEach((hostname) => {
        ns.ls(hostname)
            .filter(file=>file.endsWith('.lit'))
            .forEach(file=>ns.tprint(hostname + ' ' + file));
    })
    nmap(ns).forEach((hostname) => {
        ns.ls(hostname)
            .filter(file=>file.endsWith('.cct'))
            .forEach(file=>ns.tprint(hostname + ' ' + file));
    })
}
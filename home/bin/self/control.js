import { getPath } from './lib/backdoor.js';
import { getPlayerData } from './lib/data-store';
import { rmi } from './lib/rmi';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    let wasInTerminal = true;
    while (true) {
        const { isPlayerUsingTerminal } = getPlayerData(ns);
        if (isPlayerUsingTerminal) {
            if (!wasInTerminal)
                ns.singularity.connect('home');
        } else {
            const path = getPath(ns);
            if (path != null)
                await rmi(ns)('/bin/self/backdoor.js', 1, ...path);
            else
                await rmi(ns)('/bin/self/hack.js');
        }
        wasInTerminal = isPlayerUsingTerminal;
        await ns.sleep(100);
    }
}
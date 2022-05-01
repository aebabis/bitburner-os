import { getPath } from './lib/backdoor.js';
import { terminalTracker } from './lib/tracking';
import { rmi } from './lib/rmi';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const inTerminal = terminalTracker(ns);
    let wasInTerminal = true;
    while (true) {
        if (inTerminal()) {
            if (!wasInTerminal)
                ns.connect('home');
            wasInTerminal = true;
        } else {
            wasInTerminal = false;
            const path = getPath(ns);
            if (path != null)
                await rmi(ns)('/bin/self/backdoor.js', 1, ...path);
            else
                await rmi(ns)('/bin/self/hack.js');
        }
        await ns.sleep(100);
    }
}
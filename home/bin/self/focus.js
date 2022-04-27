import { afkTracker, terminalTracker } from './lib/tracking';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const isAfk = afkTracker(ns);
    const inTerminal = terminalTracker(ns);

    while (true) {
        if (ns.isBusy() && ns.getPlayer().crimeType == null)
            ns.setFocus(isAfk());
        if (inTerminal())
            ns.connect('home');
        await ns.sleep(200);
    }
}
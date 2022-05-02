import { afkTracker, terminalTracker } from './lib/tracking';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const afkTime = afkTracker(ns);
    const inTerminal = terminalTracker(ns);

    while (true) {
        if (ns.isBusy() && !ns.getPlayer().crimeType)
            ns.setFocus(afkTime() > 20000);
        if (inTerminal())
            ns.connect('home');
        await ns.sleep(200);
    }
}
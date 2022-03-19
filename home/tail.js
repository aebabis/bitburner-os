import { nmap } from './lib/nmap';

/** @param {NS} ns **/
export async function main(ns) {
    const flags = ns.flags([
        ['find', false],
    ]);
    if (!flags.find) {
        ns.tail(...ns.args);
    } else {
        const [script, ...args] = flags._;
        ns.tprint(script + ' ' + args);
        nmap(ns).forEach(hostname => {
            if (ns.scriptRunning(script, hostname)) {
                ns.tail(script, hostname, ...args);
            }
        });
    }
}
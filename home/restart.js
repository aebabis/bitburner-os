import { nmap } from './lib/nmap';

/** @param {NS} ns **/
export async function main(ns) {
    const script = ns.getScriptName();
    ns.tprint('Killing all processes');
    nmap(ns).forEach((hostname) => {
        ns.ps(hostname).forEach(({pid, filename, args}) => {
            // Don't kill restart task
            if (filename === script && JSON.stringify(args) === JSON.stringify(ns.args))
                return;
            ns.kill(pid);
        });
    });
    await ns.sleep(200);
    ns.tprint('Dispatching init');
    ns.exec('start.js', ns.getHostname());
}
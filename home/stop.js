import { nmap } from './nmap';

/** @param {NS} ns **/
export async function main(ns) {
    const script = ns.getScriptName();
    ns.tprint('Killing all processes');
    nmap(ns).forEach((hostname) => {
        ns.ps(hostname).forEach(({pid, filename, args}) => {
            // Don't kill restart task
            if (filename === script && args.length === 0)
                return;
            ns.kill(pid);
        });
    })
}
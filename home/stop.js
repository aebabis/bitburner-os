import { nmap } from './lib/nmap';

/** @param {NS} ns **/
export async function main(ns) {
    const script = ns.getScriptName();
    ns.tprint('Killing all processes');
    for (const hostname of nmap(ns)) {
        for (const { pid, filename, args } of ns.ps(hostname)) {
            // Don't kill restart task
            if (filename === script && args.length === 0)
                continue;
            ns.kill(pid);
        }
    }
}
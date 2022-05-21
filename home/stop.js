import { nmap } from './lib/nmap';

export const stop = async(ns) => {
    const script = ns.getScriptName();
    ns.tprint('Killing all processes');
    for (const hostname of nmap(ns)) {
        for (const { pid, filename, args } of ns.ps(hostname)) {
            // Don't kill invoking task
            const argsMatch = args.every((arg, i) => arg === ns.args[i]);
            if (filename === script && argsMatch)
                continue;
            ns.kill(pid);
        }
    }
};

/** @param {NS} ns **/
export async function main(ns) {
    await stop(ns);
}

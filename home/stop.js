import { nmap } from './lib/nmap';

export const stop = async(ns) => {
    const script = ns.getScriptName();
    ns.tprint('Killing all processes');
    for (const hostname of nmap(ns))
        for (const { pid } of ns.ps(hostname))
            if (ns.pid !== pid)
                ns.closeTail(pid) && ns.kill(pid);

    if (ns.args.length > 0)
        ns.run(...ns.args)
};

/** @param {NS} ns **/
export async function main(ns) {
    await stop(ns);
}

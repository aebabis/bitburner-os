/** @param {NS} ns **/
export async function main(ns) {
    const script = ns.getScriptName();
    ns.tprint('Killing all processes');
    ns.ps().forEach(({pid, filename, args}) => {
        // Don't kill restart task
        if (filename === script && args.length === 0)
            return;
        ns.kill(pid);
    })
    ns.tprint('Dispatching init');
    ns.exec('init.js', ns.getHostname());
}

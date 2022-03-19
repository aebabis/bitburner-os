/** @param {NS} ns **/
export const infect = async (ns, ...hostnames) => {
    for (const hostname of hostnames){
        await ns.scp('logger.js', 'home', hostname);
        await ns.scp(ns.ls('home', 'etc/'), 'home', hostname);
        await ns.scp(ns.ls('home', 'lib/'), 'home', hostname);
        await ns.scp(ns.ls('home', 'bin/'), 'home', hostname);
    }
}

/** @param {NS} ns **/
export const main = async (ns) => {
    return infect(ns, ...ns.args);
}
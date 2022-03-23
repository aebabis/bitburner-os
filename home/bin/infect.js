/** @param {NS} ns **/
export const infect = async (ns, ...hostnames) => {
    for (const hostname of hostnames){
        const rootJS = ns.ls('home', '.js').filter(name=>!name.includes('/'));
        await ns.scp(rootJS               , 'home', hostname);
        await ns.scp(ns.ls('home', 'etc/'), 'home', hostname);
        await ns.scp(ns.ls('home', 'lib/'), 'home', hostname);
        await ns.scp(ns.ls('home', 'bin/'), 'home', hostname);
    }
}

/** @param {NS} ns **/
export async function main (ns) {
    return infect(ns, ...ns.args);
}
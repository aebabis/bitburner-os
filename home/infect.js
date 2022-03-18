/** @param {NS} ns **/
export const infect = async (ns, hostname) => {
    const js = ns.ls('home').filter(f=>f.endsWith('.js'));
    await ns.scp(js, hostname);
}

/** @param {NS} ns **/
export async function main(ns) {
    return infect(ns, ns.args[0]);
}
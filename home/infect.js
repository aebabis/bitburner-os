/** @param {NS} ns **/
export async function main(ns) {
    const [hostname] = ns.args;
    const js = ns.ls('home').filter(f=>f.endsWith('.js'));
    await ns.scp(js, hostname);
}
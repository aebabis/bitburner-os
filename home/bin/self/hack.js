/** @param {NS} ns */
export async function main(ns) {
    ns.connect('n00dles');
    ns.print('Hacking n00dles...');
    ns.print(await ns.manualHack());
}
/** @param {NS} ns */
export async function main(ns) {
    try {
        ns.connect('n00dles');
        ns.print('Hacking n00dles...');
        ns.print(await ns.manualHack());
    } catch (error) {
        console.error(error);
    }
}
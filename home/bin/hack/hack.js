export async function main(ns) {
    ns.print(Date.now());
    await ns.hack(ns.args[0]);
}
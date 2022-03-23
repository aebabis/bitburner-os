export async function main(ns) {
    ns.print(Date.now());
    await ns.weaken(ns.args[0]);
}
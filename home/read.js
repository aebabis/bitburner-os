/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    const [filename] = ns.args;
    if (filename == null)
        throw new Error(`Must specify file as argument`);
    while (true) {
        const content = await ns.read(filename);
        ns.clearLog();
        ns.print(content);
        await ns.sleep(5000);
    }
}
/** @param {NS} ns **/
export async function main(ns) {
    const lines = ns.ls('home')
        .filter(file=>file.endsWith('.js'))
        .map(script => `${script.padEnd(20)} ${ns.getScriptRam(script)}GB`);
    ns.tprint('\n'+lines.join('\n'));
}
/** @param {NS} ns */
export const defer = (ns) => (...args) => {
    const sent = args.map(s=>typeof s === 'string' ? s : JSON.stringify(s));
    ns.run('/boot/defer.js', 1, ...sent);
};

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint('Deferred execution resumed: ' + JSON.stringify(ns.args));
    await ns.sleep(50);
    const [nextProgram, ...remainder] = ns.args;
    let pid;
    if (nextProgram[0] === '[') {
        const [script, ...rest] = JSON.parse(nextProgram);
        pid = ns.run(script, 1, ...rest, ...remainder);
    } else {
        pid = ns.run(nextProgram, 1, ...remainder);
    }
    if (pid === 0) {
        ns.tprint('Skipping ' + nextProgram + ' because of RAM constraints');
        defer(...remainder.map(p=>JSON.parse(p)));
    }
}
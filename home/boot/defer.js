/** @param {NS} ns */
export const defer = (ns) => (...args) => {
    ns.run('/boot/defer.js', 1, ...args);
};

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint('Deferred execution resumed: ' + JSON.stringify(ns.args));
    await ns.sleep(50);
    const [program, threads, ...args] = ns.args;
    const pid = ns.run(program, threads, args);
    if (pid === 0) {
        ns.tprint('Skipping ' + program + ' because of RAM constraints');
        defer(...args);
    }
};
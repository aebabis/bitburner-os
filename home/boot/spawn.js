/** @param {NS} ns */
export const deferLite = (ns) => (...args) => {
    const [nextProgram, ...remainder] = args;
    ns.spawn(nextProgram, 1, ...remainder);
};

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint('Deferred execution resumed: ' + JSON.stringify(ns.args));
    const [nextProgram, ...remainder] = ns.args;
    ns.spawn(nextProgram, 1, ...remainder);
};

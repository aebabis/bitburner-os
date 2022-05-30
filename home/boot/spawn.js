import { C_LIGHT, tprint } from './boot/util';

/** @param {NS} ns */
export const deferLite = (ns) => (...args) => {
    tprint(ns)(C_LIGHT + 'Deferring execution:        ' + ns.args.join(', '));
    const [nextProgram, ...remainder] = args;
    ns.spawn(nextProgram, 1, ...remainder);
};

/** @param {NS} ns */
export async function main(ns) {
    tprint(ns)(C_LIGHT + 'Deferred execution resumed: ' + ns.args.join(', '));
    const [nextProgram, ...remainder] = ns.args;
    ns.spawn(nextProgram, 1, ...remainder);
}
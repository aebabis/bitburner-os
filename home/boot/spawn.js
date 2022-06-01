import { tprint } from './boot/util';
import { GRAY } from './lib/colors';

/** @param {NS} ns */
export const deferLite = (ns) => (...args) => {
    tprint(ns)(GRAY + '  Deferring execution:        ' + ns.args.join(', '));
    const [nextProgram, ...remainder] = args;
    ns.spawn(nextProgram, 1, ...remainder);
};

/** @param {NS} ns */
export async function main(ns) {
    tprint(ns)(GRAY + '  Deferred execution resumed: ' + ns.args.join(', '));
    const [nextProgram, ...remainder] = ns.args;
    ns.spawn(nextProgram, 1, ...remainder);
}
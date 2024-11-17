import { tprint } from '/boot/util';
import { GRAY } from '/lib/colors';

/** @param {NS} ns */
export const defer = (ns) => async (...args) => {
    tprint(ns)(GRAY + '  Deferring execution:        ' + ns.args.join(', '));
    const sent = args.map(s=>typeof s === 'string' ? s : JSON.stringify(s));
    await ns.sleep(50);
    ns.run('/boot/defer.js', 1, ...sent);
};

/** @param {NS} ns */
export async function main(ns) {
    tprint(ns)(GRAY + '  Deferred execution resumed: ' + ns.args.join(', '));
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
        await defer(ns)(...remainder.map(p=>JSON.parse(p)));
    }
}

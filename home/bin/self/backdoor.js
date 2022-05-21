import { stop } from './stop';

/** @param {NS} ns */
export async function main(ns) {
    const path = ns.args.slice();

    // Hop along path to target
    for (const hostname of path)
        ns.connect(hostname);

    // Kill all scripts before backdooring
    // final server to prevent glitches.
    if (path.pop() === 'w0r1d_d43m0n')
        await stop(ns);

    await ns.installBackdoor();
}

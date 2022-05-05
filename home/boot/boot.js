import { defer } from './boot/defer';

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint('Starting boot sequence');

    const BOOT_SEQUENCE = [
        '/boot/step1.js',
        '/boot/step2.js',
        '/boot/step3.js', // Will only work if there's enough RAM
        '/bin/scheduler.js',
    ];

    defer(ns)(...BOOT_SEQUENCE);
}


// Network
// Data-core
// Data-sourcefiles (defaults to [])
// Data2 / Data2-lite
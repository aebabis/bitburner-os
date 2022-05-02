import { defer } from './boot/defer';

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint('Starting boot sequence');

    const BOOT_SEQUENCE = [
        '/boot/step1.js', 1,
        '/boot/step2.js', 1,
        '/boot/step3.js', 1, // Will only work if there's enough RAM
        '/bin/scheduler.js', 1,
    ];

    defer(ns)(...BOOT_SEQUENCE);
}
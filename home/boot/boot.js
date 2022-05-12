import { defer } from './boot/defer';

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint('Starting boot sequence');


    const DATA2 = (ns.getServerMaxRam('home') === 8) ?
        ['/boot/spawn.js', '/boot/data2-lite.js'] :
         '/boot/data2.js';

    const BOOT_SEQUENCE = [
        '/boot/reset.js',
        '/boot/network.js',
        '/boot/data.js',
         DATA2,
        '/boot/data3.js',
        '/bin/scheduler.js',
    ];

    defer(ns)(...BOOT_SEQUENCE);
}

import { defer } from './boot/defer';
import { C_TITLE, tprint } from './boot/util';

const getBootSequence = (ns) => {
    if (ns.getServerMaxRam('home') === 8) {
        return [
            '/boot/reset.js',
            '/boot/ui.js',
            '/boot/network.js',
            '/boot/data.js',
            ['/boot/spawn.js', '/boot/data2-lite.js'],
            '/bin/scheduler.js',
        ];
    } else {
        return [
            '/boot/reset.js',
            '/boot/ui.js',
            '/boot/network.js',
            '/boot/data.js',
            '/boot/data2.js',
            '/boot/data3.js',
            '/bin/scheduler.js',
        ];
    }
}

/** @param {NS} ns */
export async function main(ns) {
    tprint(ns)(C_TITLE + 'STARTING BOOT SEQUENCE');

    const BOOT_SEQUENCE = getBootSequence(ns);

    await defer(ns)(...BOOT_SEQUENCE);
}

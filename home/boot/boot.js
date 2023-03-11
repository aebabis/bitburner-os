import { defer } from './boot/defer';
import { tprint } from './boot/util';
import { STR } from './lib/colors';

const getBootSequence = (ns) => {
    if (ns.getServerMaxRam('home') < ns.getScriptRam('/boot/data2.js')) {
        return [
            '/boot/reset.js',
            '/boot/ui.js',
            '/boot/network.js',
            '/boot/data.js',
            ['/boot/spawn.js', '/boot/data2-lite.js'],
            '/bin/eight-gig.js',
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
    tprint(ns)(STR.BOLD + 'STARTING BOOT SEQUENCE');

    const BOOT_SEQUENCE = getBootSequence(ns);

    await defer(ns)(...BOOT_SEQUENCE);
}
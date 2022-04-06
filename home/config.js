import { SHARE_FILE } from './etc/filenames';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    const [command, ...args] = ns.args;

    if (command === 'share') {
        const rate = +args[0];
        if (rate === rate) {
            ns.tprint(`Setting share rate to ${rate}`);
            await ns.write(SHARE_FILE, rate, 'w');
        }
        return;
    }
}

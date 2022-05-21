import { stop } from './stop';

/** @param {NS} ns */
export async function main(ns) {
    await stop(ns);
    await ns.wget('https://raw.githubusercontent.com/aebabis/bitburner-os/main/download.js', 'download.js', 'home');
    const pid = ns.exec('download.js', 'home');
    while (ns.isRunning(pid))
        await ns.sleep(50);
    ns.exec('start.js', 'home');
}

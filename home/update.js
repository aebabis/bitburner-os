import { stop } from './stop';

/** @param {NS} ns */
export async function main(ns) {
    const { branch } = ns.flags([['branch', 'main']]);
    await stop(ns);
    await ns.wget(`https://raw.githubusercontent.com/aebabis/bitburner-os/${branch}/download.js`, 'download.js', 'home');
    const pid = ns.exec('download.js', 'home', '--branch', branch);
    while (ns.isRunning(pid))
        await ns.sleep(50);
    ns.exec('start.js', 'home');
}

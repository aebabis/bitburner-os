import { stop } from './stop';

/** @param {NS} ns */
export async function main(ns) {
    const { branch, wipe } = ns.flags([
        ['branch', 'main'],
        ['wipe', false],
    ]);
    await stop(ns);
    if (wipe)
        ns.ls('home', '.js').forEach(file => ns.rm(file));
    await ns.wget(`https://raw.githubusercontent.com/aebabis/bitburner-os/${branch}/download.js`, 'download.js', 'home');
    const pid = ns.exec('download.js', 'home', 1, '--branch', branch);
    while (ns.isRunning(pid))
        await ns.sleep(50);
    ns.exec('start.js', 'home');
}

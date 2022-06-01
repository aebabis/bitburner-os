import { THREADPOOL } from './etc/config';
import { by } from './lib/util';
import { defer } from './boot/defer';
import { access } from './bin/access';
import { infect, fullInfect } from './bin/infect';
import { getHostnames } from './lib/data-store';
import { tprint } from './boot/util';
import { STR, GRAY } from './lib/colors';

const canRunCode = (ns) => (hostname) => ns.getServerMaxRam(hostname) >= 1.6;

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    tprint(ns)(STR.BOLD + 'CONFIGURING NETWORK');

    const hostnames = getHostnames(ns);

    // Try to get more starting RAM
    tprint(ns)(STR + '  Hacking low-level servers');
    hostnames.forEach(access(ns));

    // Erase old versions of files, then upload
    // the batchable files to every server
    tprint(ns)(STR + '  Uploading batch files');
    for (const hostname of hostnames) {
        if (hostname !== 'home' && canRunCode(ns)(hostname)) {
            await infect(ns, hostname);
        }
    }

    // To reduce the size of the game save file,
    // only put the non-batch code on the first
    // N servers. This amount can be adjusted as needed.
    const SERVERS_NEEDED = 10;
    const zombies = hostnames
        .filter(hostname => hostname !== 'home')
        .filter(hostname => !hostname.startsWith(THREADPOOL))
        .filter(canRunCode(ns))
        .sort(by(ns.getServerRequiredHackingLevel))
        .slice(0, SERVERS_NEEDED);
    tprint(ns)(STR + '  Infecting zombies: ' + GRAY + zombies.join(', '));
    await fullInfect(ns, ...zombies);
    try { await fullInfect(ns, `${THREADPOOL}-01`, `${THREADPOOL}-02`) }
    catch {/*Do nothing*/}

    // Go to next step in the boot sequence
	await defer(ns)(...ns.args);
}
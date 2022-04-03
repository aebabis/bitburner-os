import { SHARE_FILE } from './etc/filenames';
import { delegateAny } from './lib/scheduler-delegate';
// import { uuid } from './lib/util';
import { nmap } from './lib/nmap';

const SHARE = '/bin/gen/share.js';
const SHARE_SRC = `export async function main(ns) {
    while (true) {
        await ns.share();
    }
}`;

const sum = (a,b)=>a+b;

let MIN_WAIT = 50;
let MAX_WAIT = 10000;

/** @param {NS} ns **/
export const getTotalRam = (ns) => nmap(ns).map(ns.getServer)
	.map(({ maxRam }) => maxRam).reduce(sum, 0);

/** @param {NS} ns **/
const getSharedThreads = (ns) => {
    return nmap(ns).map((server) => {
        return ns.ps(server)
            .filter(({filename}) => filename === SHARE)
            .map(({ threads }) => threads)
            .reduce(sum , 0);
    }).reduce(sum, 0);
}

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    await ns.write(SHARE, SHARE_SRC, 'w');
    const RAM_PER_SHARE = ns.getScriptRam(SHARE);

    if (ns.args[0] != null) {
        const rate = +ns.args[0];
        if (rate === rate) {
            ns.tprint(`Setting share rate to ${rate}`);
            await ns.write(SHARE_FILE, rate, 'w');
        }
        return;
    }

    let wait = MIN_WAIT;
    while (true) {
        const shareRate = +(await ns.read(SHARE_FILE));

        const ramToUse = shareRate * getTotalRam(ns);
        const desiredThreads = Math.floor(ramToUse / RAM_PER_SHARE);
        const maxDesiredThreads = desiredThreads * 1.1;
    
        function* ps() {
            const servers = nmap(ns);
            while (servers.length > 0) {
                const server = servers.shift();
                const processes = ns.ps(server);
                while (processes.length > 0) {
                    const process = processes.shift();
                    if (process.filename === SHARE)
                        yield process;
                }
            }
        }

        let sharedThreads = getSharedThreads(ns);
        if (sharedThreads > maxDesiredThreads) {
            ns.print(`Overallocated. T=${sharedThreads} MAX=${maxDesiredThreads}`);
            const processes = ps();
            let process;
            while (sharedThreads > maxDesiredThreads && (process = processes.next().value)) {
               ns.kill(process.pid);
               sharedThreads -= process.threads;
            }
        }

        if (sharedThreads < desiredThreads) {
            const threadsNeeded = desiredThreads - sharedThreads;
            ns.print(`Need ${threadsNeeded} more threads`);
            wait = MIN_WAIT;
            try {
                await delegateAny(ns)(SHARE, threadsNeeded, crypto.randomUUID());
            } catch (error) {
                ns.print(`ERROR ` + error);
            }
        } else {
            ns.print(`Threads in target range: ${sharedThreads}/${desiredThreads}`);
            wait = Math.min(MAX_WAIT, wait * 2);
        }
        await ns.sleep(wait);
    }
}
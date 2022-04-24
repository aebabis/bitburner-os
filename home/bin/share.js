import { delegateAny } from './lib/scheduler-delegate';
import { nmap } from './lib/nmap';
import { SHARE } from './etc/filenames';
import getConfig from './lib/config';

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
    const config = getConfig(ns);
    const RAM_PER_SHARE = ns.getScriptRam(SHARE);

    let wait = MIN_WAIT;
    while (true) {
        const shareRate = config.get('share');

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
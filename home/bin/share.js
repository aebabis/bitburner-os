import { SHARE } from '/etc/filenames';
import getConfig from '/lib/config';
import { getStaticData, getRamData } from '/lib/data-store';
import { delegateAny } from '/lib/scheduler-delegate';

const sum = (a,b)=>a+b;

let MIN_WAIT = 50;
let MAX_WAIT = 10000;

/** @param {NS} ns **/
export const getTotalRam = (ns) => getRamData(ns).totalMaxRam;

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    const config = getConfig(ns);
    const RAM_PER_SHARE = getStaticData(ns).scriptRam[SHARE];
    let processes = [];

    let wait = MIN_WAIT;
    while (true) {
        const shareRate = config.get('share');
        const shareCap = config.get('share-cap');

        const ramToUse = Math.min(shareCap, shareRate * getTotalRam(ns));
        const desiredThreads = Math.floor(ramToUse / RAM_PER_SHARE);
        const maxDesiredThreads = desiredThreads * 1.1;

        processes = processes.filter(process=>ns.isRunning(process.pid));

        let sharedThreads = processes.map(({ threads }) => threads).reduce(sum, 0);
        if (sharedThreads > maxDesiredThreads) {
            ns.print(`Overallocated. T=${sharedThreads} MAX=${maxDesiredThreads}`);
            while (sharedThreads > maxDesiredThreads) {
                const process = processes.shift();
                ns.kill(process.pid);
                sharedThreads -= process.threads;
            }
        }

        if (sharedThreads < desiredThreads) {
            const threadsNeeded = desiredThreads - sharedThreads;
            ns.print(`Need ${threadsNeeded} more threads`);
            wait = MIN_WAIT;
            try {
                const process = await delegateAny(ns, true)(SHARE, threadsNeeded, crypto.randomUUID());
                processes.push(process);
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

import { SHARE } from '../etc/filenames';
import { getConfig } from '../lib/config';
import { getStaticData, getRamData, getHostnames } from '../lib/data-store';
import { delegateAny } from '../lib/scheduler-delegate';

const sum = (/** @type {number} */ a, /** @type {number} */ b) => a + b;

let MIN_WAIT = 50;
let MAX_WAIT = 10000;

export const getTotalRam = (ns: NS) => getRamData(ns).totalMaxRam;

export async function main(ns: NS) {
  ns.disableLog('ALL');
  const config = getConfig(ns);
  const RAM_PER_SHARE = getStaticData(ns).scriptRam[SHARE.slice(1)];

  let wait = MIN_WAIT;
  while (true) {
    const shareRate = config.get('share');
    const shareCap = config.get('share-cap');
    const hostnames = getHostnames(ns);
    const processes = hostnames
      .flatMap((hostname) => ns.ps(hostname))
      .filter((process) => SHARE.includes(process.filename));

    const ramToUse = Math.min(shareCap, shareRate * getTotalRam(ns));
    const desiredThreads = Math.floor(ramToUse / RAM_PER_SHARE);
    const maxDesiredThreads = desiredThreads * 1.1;

    let sharedThreads = processes.map(({ threads }) => threads).reduce(sum, 0);
    if (sharedThreads > maxDesiredThreads) {
      ns.print(`Overallocated. T=${sharedThreads} MAX=${maxDesiredThreads}`);
      while (sharedThreads > maxDesiredThreads) {
        const process =
          /** @type {{pid: number, threads: number}} */ processes.shift();
        ns.kill(process.pid);
        sharedThreads -= process.threads;
      }
    }

    if (sharedThreads < desiredThreads) {
      const threadsNeeded = desiredThreads - sharedThreads;
      ns.print(`Need ${threadsNeeded} more threads`);
      wait = MIN_WAIT;
      try {
        const process = await delegateAny(ns, true)(
          SHARE,
          threadsNeeded,
          crypto.randomUUID(),
        );
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

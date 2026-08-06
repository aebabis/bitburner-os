import { SHARE } from '../etc/filenames';
import { getStaticData } from '../lib/data-store';
import { getWorkerRamState } from '../lib/ram-router';

export async function main(ns: NS) {
  ns.disableLog('ALL');

  const RAM_PER_SHARE = getStaticData(ns).scriptRam[SHARE.slice(1)];

  while (true) {
    const { targetThreads, currentThreads, currentWorkers, unusedRam } = getWorkerRamState(
      ns,
      SHARE,
    );
    const maxDesiredThreads = targetThreads * 1.1;

    if (currentThreads > maxDesiredThreads) {
      ns.print(`Overallocated. T=${currentThreads} MAX=${maxDesiredThreads}`);
      let remainingThreads = currentThreads;
      while (remainingThreads > maxDesiredThreads) {
        const process = currentWorkers.shift()!;
        ns.kill(process.pid);
        remainingThreads -= process.threads;
      }
    } else if (currentThreads < targetThreads) {
      let threadsNeeded = targetThreads - currentThreads;
      ns.print(`Need ${threadsNeeded} more threads`);
      for (const [hostname, ram] of Object.entries(unusedRam)) {
        const threads = Math.min(Math.floor(ram / RAM_PER_SHARE), threadsNeeded);
        if (threads) {
          if (ns.exec(SHARE, hostname, { threads, temporary: true })) {
            threadsNeeded -= threads;
            if (!threadsNeeded) {
              break;
            }
          }
        }
      }
    } else {
      ns.print(`Threads in target range: ${currentThreads}/${targetThreads}`);
    }
    await ns.sleep(10000);
  }
}

import { SHARE } from '../etc/filenames';
import { getStaticData, getHostnames } from '../lib/data-store';
import { getRamAllowances, getWorkerRam } from '../lib/ram-router';

export async function main(ns: NS) {
  ns.disableLog('ALL');

  const RAM_PER_SHARE = getStaticData(ns).scriptRam[SHARE.slice(1)];

  while (true) {
    const hostnames = getHostnames(ns);
    const processes = hostnames
      .flatMap((hostname) => ns.ps(hostname))
      .filter((process) => SHARE.includes(process.filename));

    const { sharingRam } = getRamAllowances(ns);
    const desiredThreads = Math.floor(sharingRam / RAM_PER_SHARE);
    const maxDesiredThreads = desiredThreads * 1.1;

    let sharedThreads = processes.map(({ threads }) => threads).reduce((a, b) => a + b, 0);
    if (sharedThreads > maxDesiredThreads) {
      ns.print(`Overallocated. T=${sharedThreads} MAX=${maxDesiredThreads}`);
      while (sharedThreads > maxDesiredThreads) {
        const process = processes.shift()!;
        ns.kill(process.pid);
        sharedThreads -= process.threads;
      }
    }

    if (sharedThreads < desiredThreads) {
      let threadsNeeded = desiredThreads - sharedThreads;
      ns.print(`Need ${threadsNeeded} more threads`);
      const workerRam = getWorkerRam(ns, SHARE);
      for (const [hostname, ram] of Object.entries(workerRam)) {
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
      ns.print(`Threads in target range: ${sharedThreads}/${desiredThreads}`);
    }
    await ns.sleep(100);
  }
}

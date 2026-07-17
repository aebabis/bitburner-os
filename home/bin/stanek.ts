import { CHARGE } from '../etc/filenames';
import { getStaticData, putPlayerData } from '../lib/data-store';
import { getRamAllowances, getWorkerRam } from '../lib/ram-router';

export async function main(ns: NS) {
  ns.disableLog('ALL');

  while (!ns.stanek.acceptGift()) await ns.sleep(50);

  putPlayerData(ns, { hasGift: true });

  const RAM_PER_SHARE = getStaticData(ns).scriptRam[CHARGE.replace(/^\//, '')];

  const chargeThreads = new Map<number, number>();

  while (true) {
    ns.clearLog();
    ns.print(ns.stanek.giftWidth() + 'x' + ns.stanek.giftHeight());
    ns.print(ns.stanek.fragmentDefinitions());
    const currentThreads = [...chargeThreads.entries()]
      .filter(([pid]) => ns.isRunning(pid))
      .map(([, threads]) => threads)
      .reduce((a, b) => a + b, 0);

    const coords = ns.stanek
      .activeFragments()
      .filter((fragment) => fragment.type !== ns.enums.FragmentType.Booster)
      .flatMap(({ x, y }) => [x, y]);

    if (coords.length > 0) {
      // Get target RAM usage
      const { stanekRam } = getRamAllowances(ns);
      const desiredThreads = Math.floor(stanekRam / RAM_PER_SHARE);
      ns.print('Current threads: ' + currentThreads + '/' + desiredThreads);
      if (currentThreads < desiredThreads) {
        let threadsNeeded = desiredThreads - currentThreads;
        ns.print(`Need ${threadsNeeded} more threads`);
        const workerRam = getWorkerRam(ns, CHARGE);
        for (const [hostname, ram] of Object.entries(workerRam)) {
          const threads = Math.min(Math.floor(ram / RAM_PER_SHARE), threadsNeeded);
          if (threads) {
            const pid = ns.exec(CHARGE, hostname, { threads, temporary: true }, ...coords);
            if (pid !== 0) {
              threadsNeeded -= threads;
              chargeThreads.set(pid, threads);
              if (!threadsNeeded) {
                break;
              }
            }
          }
        }
      }
    }
    await ns.sleep(1000);
  }
}

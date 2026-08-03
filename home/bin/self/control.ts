import { ERROR } from '../../lib/colors.ts';
import { getMoneyData, putMoneyData } from '../../lib/data-store.ts';
import { inPlace, runInPlace } from '../../lib/in-place.ts';
import { $nmap } from '../../lib/nmap.rip.ts';
import { $getBackdoorPath } from '../../lib/backdoor.rip.ts';
import { formatTime } from '../../lib/util.ts';

export async function main(ns: NS) {
  ns.disableLog('ALL');

  // Reserve RAM
  ns.singularity.connect;
  ns.scan;
  ns.getHackingLevel;

  const $ = inPlace(ns, ns.pid);
  const $rip = runInPlace(ns, ns.pid);

  const $manHack = async (hostname: string) => {
    await $.singularity['connect'](hostname);
    const expectedTime = ns.getHackTime(hostname) / 1000;
    ns.print(`Hacking:     ${hostname} (${formatTime(expectedTime)})`);
    const start = Date.now();
    const money = await $.singularity['manualHack']();
    const end = Date.now();
    const s = (end - start) / 1000;
    const manualHackIncome = money / s;
    ns.print(`  $${ns.format.number(money)}, ${formatTime(s)}`);
    ns.print(`  $${ns.format.number(manualHackIncome)}/s`);
    putMoneyData(ns, { manualHackIncome });
  };

  // Single run on n00dles provides income data quickly
  await $manHack('n00dles');

  while (true) {
    const hostnames = await $nmap(ns, ns.pid)();
    const path = await $getBackdoorPath(ns, ns.pid)(hostnames);
    try {
      if (path != null && path.at(-1) !== 'w0r1d_d43m0n') {
        await $rip((path: string[]) => {
          for (const hostname of path) ns.singularity['connect'](hostname);
        })(path);
        ns.print(`Backdooring: ${path.at(-1)}`);
        await $.singularity['installBackdoor']();
      } else {
        const { theft } = getMoneyData(ns);
        const hostname = theft?.target;
        if (hostname != null) await $manHack(hostname);
      }
    } catch (error) {
      ns.print(ERROR + error);
      ns.print(ERROR + '  (player probably started using terminal)');
    }
    await ns.sleep(100);
  }
}

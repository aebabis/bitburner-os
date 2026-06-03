import { initProfiler } from '../lib/profiler';

const getWeakThreads = (ns: NS, targetDecrease: number) => {
  let threads = 1;
  while (ns.formulas.hacking.weakenEffect(threads) < targetDecrease) threads++;
  return threads;
};

const getFrame = (
  ns: NS,
  hostname: string,
  hackThreads: number,
): [number, number, number] => {
  const server = ns.getServer(hostname);
  if (
    hostname === 'home' ||
    typeof server.moneyAvailable !== 'number' ||
    typeof server.moneyMax !== 'number' ||
    typeof server.hackDifficulty !== 'number'
  ) {
    throw new Error('Not a hackable server');
  }
  const hackPortion = ns.hackAnalyze(hostname) * hackThreads;
  const hackSecurity = ns.hackAnalyzeSecurity(hackThreads, hostname);
  const serverH = {
    ...server,
    moneyAvailable: server.moneyAvailable - server.moneyMax * hackPortion,
    hackDifficulty: server.hackDifficulty + hackSecurity,
  };
  const growThreads = ns.formulas.hacking.growThreads(
    serverH,
    ns.getPlayer(),
    server.moneyMax,
  );
  const growSecurity = ns.growthAnalyzeSecurity(growThreads);
  const weakThreads = getWeakThreads(ns, hackSecurity + growSecurity);
  return [hackThreads, growThreads, weakThreads];
};

let workerId = 0;

export async function main(ns: NS) {
  initProfiler();
  ns.disableLog('ALL');

  const WIDTH = 800;
  const HEIGHT = 150;
  ns.ui.openTail();
  ns.ui.resizeTail(WIDTH, HEIGHT);
  ns.ui.moveTail(300, 2);

  while (true) {
    let [target = 'phantasy'] = ns.args as string[];

    const [hackThreads, growThreads, weakThreads] = getFrame(ns, target, 1);
    const ramPerFrame =
      hackThreads * 1.7 + growThreads * 1.75 + weakThreads * 1.75;

    const hackTime = ns.getHackTime(target);
    const growTime = ns.getGrowTime(target);
    const weakTime = ns.getWeakenTime(target);
    const endTime = Date.now() + weakTime + 1000;

    ns.print(hackThreads + ' ' + growThreads + ' ' + weakThreads);
    ns.print(endTime - hackTime);
    ns.print(endTime - growTime);
    ns.print(endTime - weakTime);

    let offsetCounter = 0;
    const offset = () => 0; //(offsetCounter++);

    while (true) {
      const hostname = ns.cloud
        .getServerNames()
        .find(
          (hostname) =>
            ns.getServer(hostname).maxRam - ns.getServer(hostname).ramUsed >=
            ramPerFrame,
        );
      if (hostname == null) break;

      let ramLeft =
        ns.getServer(hostname).maxRam - ns.getServer(hostname).ramUsed;
      while (ramLeft > ramPerFrame) {
        if (
          ns.exec(
            'bin/workers/hackshot.ts',
            hostname,
            hackThreads,
            target,
            endTime - hackTime,
            workerId++,
          ) &&
          ns.exec(
            'bin/workers/growshot.ts',
            hostname,
            growThreads,
            target,
            endTime - growTime,
            workerId++,
          ) &&
          ns.exec(
            'bin/workers/weakshot.ts',
            hostname,
            weakThreads,
            target,
            endTime - weakTime,
            workerId++,
          )
        ) {
          ramLeft -= ramPerFrame;
        } else {
          throw new Error('Could not start worker program on ' + hostname);
        }
      }
    }

    await ns.sleep(endTime - Date.now());
  }
}

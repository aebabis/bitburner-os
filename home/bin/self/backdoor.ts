export async function main(ns: NS) {
  ns.disableLog('ALL');
  const path = ns.args.slice() as string[];

  if (path[path.length - 1] === 'w0r1d_d43m0n') {
    ns.killall('home', true);
    ns.exec('/bin/self/actualize.ts', 'home');
    return;
  }

  // Hop along path to target
  for (const hostname of path) ns.singularity.connect(hostname);

  await ns.singularity.installBackdoor();

  ns.singularity.connect('home');
}

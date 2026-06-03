import { rmi } from '../../lib/rmi';
import { stop } from '../../stop';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  const path = ns.args.slice() as string[];

  if (path[path.length - 1] === 'w0r1d_d43m0n') {
    // will fall through if not enough RAM
    await rmi(ns)('/bin/self/actualize.ts', 1, 12, 'start.ts');
    // Kill all scripts before backdooring
    // final server to prevent glitches.
    await stop(ns);
  }

  // Hop along path to target
  for (const hostname of path) ns.singularity.connect(hostname);

  await ns.singularity.installBackdoor();

  ns.singularity.connect('home');
}

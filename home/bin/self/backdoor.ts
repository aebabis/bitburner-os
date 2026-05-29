import { stop } from '../../stop';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  const path = ns.args.slice();

  // Kill all scripts before backdooring
  // final server to prevent glitches.
  if (path[path.length - 1] === 'w0r1d_d43m0n') await stop(ns);

  // Hop along path to target
  for (const hostname of path) ns.singularity.connect(hostname);

  await ns.singularity.installBackdoor();
}

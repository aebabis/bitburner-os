export async function main(ns: NS) {
  ns.disableLog('ALL');
  const path = ns.args.slice() as string[];

  // Hop along path to target
  for (const hostname of path) ns.singularity.connect(hostname);

  await ns.singularity.installBackdoor();

  ns.singularity.connect('home');
}

import { stop } from './stop';

export async function main(ns: NS) {
  const { branch, wipe } = ns.flags([
    ['branch', 'main'],
    ['wipe', false],
  ]);
  await stop(ns);
  if (wipe) ns.ls('home', '.ts').forEach((file) => ns.rm(file));
  await ns.wget(
    `https://raw.githubusercontent.com/aebabis/bitburner-os/${branch}/download.js`,
    'download.ts',
    'home',
  );
  const pid = ns.exec(
    'download.ts',
    'home',
    1,
    '--branch',
    /** @type {ScriptArg} */ branch,
  );
  while (ns.isRunning(pid)) await ns.sleep(50);
  ns.exec('start.ts', 'home');
}

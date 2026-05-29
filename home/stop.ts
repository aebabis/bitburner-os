import { nmap } from './lib/nmap';
import { HACK } from './etc/filenames';

export const stop = async (ns: NS) => {
  const processes = () =>
    nmap(ns)
      .flatMap((hostname) => ns.ps(hostname))
      .filter((ps) => ps.pid !== ns.pid);

  /** @param {number} pid **/
  const kill = (pid) => {
    ns.ui.closeTail(pid);
    ns.kill(pid);
  };

  for (const process of processes()) {
    if (process.filename.match(HACK.slice(1))) {
      kill(process.pid);
    }
  }
  await ns.sleep(1000);

  ns.tprint('Killing all processes');
  for (const { pid } of processes()) {
    kill(pid);
  }
};

export async function main(ns: NS) {
  await stop(ns);
  if (ns.args.length > 0) {
    ns.run(.../** @type {[string, ...ScriptArg[]]} */ ns.args);
  }
}

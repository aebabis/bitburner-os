import { nmap } from "./lib/nmap";
import { HACK } from './etc/filenames';

/** @param {NS} ns **/
export const stop = async (ns) => {
  const processes = () => nmap(ns)
    .flatMap((hostname) => ns.ps(hostname))
    .filter((ps) => ps.pid !== ns.pid);

  /** @param {number} pid **/
  const kill = (pid) => {
    ns.ui.closeTail(pid);
    ns.kill(pid);
  }

  for (const process of processes()) {
    if (process.filename.match(HACK.slice(1))) {
      kill(process.pid);
    }
  }
  await ns.sleep(1000);

  ns.tprint("Killing all processes");
  for (const { pid } of processes()) {
    kill(pid);
  }

  if (ns.args.length > 0) {
    ns.run(.../** @type {[string, ...ScriptArg[]]} */ (ns.args));
  }
};

/** @param {NS} ns **/
export async function main(ns) {
  await stop(ns);
}

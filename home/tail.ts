import { nmap } from './lib/nmap';

export async function main(ns: NS) {
  const flags = ns.flags([['find', false]]);
  if (!flags.find) {
    ns.ui.openTail(...ns.args);
  } else {
    const [script, ...args] = flags._;
    ns.tprint(script + ' ' + args);
    nmap(ns).forEach((hostname) => {
      if (ns.scriptRunning(script, hostname)) {
        ns.ui.openTail(script, hostname, ...args);
      }
    });
  }
}

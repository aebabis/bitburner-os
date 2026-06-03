import { getPath } from '../../lib/backdoor.ts';
import { getPlayerData } from '../../lib/data-store';
import { rmi } from '../../lib/rmi';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  while (true) {
    const { isPlayerUsingTerminal } = getPlayerData(ns);
    if (!isPlayerUsingTerminal) {
      const path = getPath(ns);
      if (path != null) await rmi(ns)('/bin/self/backdoor.ts', 1, ...path);
      else await rmi(ns)('/bin/self/hack.ts');
    }
    await ns.sleep(100);
  }
}

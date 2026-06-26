import { getStaticData, putStaticData } from '../lib/data-store';
import { defer } from './defer';
import { tprint } from './util';
import { getCallGraph } from './call-graph';
import { STR } from '../lib/colors';

export async function main(ns: NS) {
  tprint(ns)(STR.BOLD + 'Determining required job RAM');

  const { scriptRam, resetInfo } = getStaticData(ns);

  const callGraph = getCallGraph(ns);

  const getRam = (script: string) => scriptRam[script.replace(/^\.*[/]/, '')];
  const getRamDepth = (script: string): number => {
    if (callGraph[script] == null) throw new Error(script + ' not found in call graph');
    return getRam(script) + Math.max(0, ...callGraph[script].map(getRamDepth));
  };

  let requiredAugRam = 0;
  if (resetInfo.currentNode === 4 || resetInfo.ownedSF.has(4)) {
    const augScripts = Object.keys(scriptRam).filter((s) => s.startsWith('bin/self/aug/'));
    const maxAugRam = Math.max(0, ...augScripts.map(getRam));
    requiredAugRam = 1;
    while (requiredAugRam < maxAugRam) requiredAugRam *= 2;
  }
  tprint(ns)(STR + `  Aug Suite RAM Required: ${requiredAugRam}GB`);

  putStaticData(ns, { requiredAugRam });

  // Go to next step in the boot sequence
  await defer(ns)(...ns.args);
}

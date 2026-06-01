import { getStaticData, putStaticData } from '../lib/data-store';
import { defer } from './defer';
import { tprint } from './util';
import { getCallGraph } from './call-graph';
import { STR } from '../lib/colors';
import { getViableServices } from '../bin/services/services';

export async function main(ns: NS) {
  tprint(ns)(STR.BOLD + 'Determining required job RAM');

  const { scriptRam, resetInfo } = getStaticData(ns);

  const callGraph = getCallGraph(ns);
  const services = getViableServices(ns, (ns: NS) => ns.getPlayer()).map(
    (service) => service.toData().script,
  );

  const getRam = (script: string) => scriptRam[script.replace(/^\.*[/]/, '')];
  const getRamDepth = (script: string): number => {
    return getRam(script) + Math.max(0, ...callGraph[script].map(getRamDepth));
  };

  const minServiceRam = services.map(getRamDepth).reduce((a, b) => a + b, 0);

  let requiredJobRam = 1;
  while (requiredJobRam < minServiceRam) requiredJobRam *= 2;
  tprint(ns)(STR + `  Job RAM Required: ${requiredJobRam}GB`);

  let requiredAugRam = 0;
  if (resetInfo.currentNode === 4 || resetInfo.ownedSF.has(4)) {
    const augScripts = Object.keys(scriptRam).filter((s) =>
      s.startsWith('bin/self/aug/'),
    );
    const maxAugRam = Math.max(0, ...augScripts.map(getRam));
    requiredAugRam = 1;
    while (requiredAugRam < maxAugRam) requiredAugRam *= 2;
  }
  tprint(ns)(STR + `  Aug Suite RAM Required: ${requiredAugRam}GB`);

  putStaticData(ns, { requiredJobRam, requiredAugRam });

  // Go to next step in the boot sequence
  await defer(ns)(...ns.args);
}

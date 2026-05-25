import { getStaticData, putStaticData } from '../lib/data-store';
import { defer } from './defer';
import { tprint } from './util';
import { getCallGraph } from './call-graph';
import { STR } from '../lib/colors';
import { getViableServices } from '../bin/services/services';

/** @param {NS} ns */
export async function main(ns) {
  tprint(ns)(STR.BOLD + "Determining required job RAM");

  const { scriptRam } = getStaticData(ns);
  
  const callGraph = getCallGraph(ns);
  const services = getViableServices(ns)
    .map((service) => service.toData().script);

  /** @param {string} script */
  const getRam = (script) => scriptRam[script.replace(/^\.*[/]/, '')];
  /** @param {string} script @returns {number} **/
  const getRamDepth = (script) => {
    return getRam(script) + Math.max(0, ...callGraph[script].map(getRamDepth));
  };

  const minServiceRam = services.map(getRamDepth)
    .reduce((a, b) => a+b, 0);

  let requiredJobRam = 1;
  while (requiredJobRam < minServiceRam) requiredJobRam *= 2;
  tprint(ns)(STR + `  Job RAM Required: ${requiredJobRam}GB`);

  const augScripts = Object.keys(scriptRam).filter(s => s.startsWith('bin/self/aug/'));
  const maxAugRam = Math.max(0, ...augScripts.map(getRam));
  let requiredAugRam = 1;
  while (requiredAugRam < maxAugRam) requiredAugRam *= 2;
  tprint(ns)(STR + `  Aug Suite RAM Required: ${requiredAugRam}GB`);

  putStaticData(ns, { requiredJobRam, requiredAugRam });

  // Go to next step in the boot sequence
  await defer(ns)(...ns.args);
}

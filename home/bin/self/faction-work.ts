import { shouldWorkHaveFocus } from '../../lib/query-service';
import { putPlayerData } from '../../lib/data-store';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  const [faction] = ns.args as FactionName[];
  const focus = shouldWorkHaveFocus(ns);
  const currentWork = ns.singularity.getCurrentWork();
  if (
    currentWork != null &&
    'factionName' in currentWork &&
    currentWork.factionName === faction
  )
    return;
  if (
    ns.singularity.workForFaction(faction, 'hacking', focus) ||
    ns.singularity.workForFaction(faction, 'field', focus) ||
    ns.singularity.workForFaction(faction, 'security', focus)
  ) {
    putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
  }
}

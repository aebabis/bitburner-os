import { shouldWorkHaveFocus } from '../../lib/query-service';
import { putPlayerData } from '../../lib/data-store';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  const focus = shouldWorkHaveFocus(ns);
  ns.singularity.workForCompany("Joe's Guns", focus);
  putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
}

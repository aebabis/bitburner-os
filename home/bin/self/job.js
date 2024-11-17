import { shouldWorkHaveFocus } from '/lib/query-service';
import { putPlayerData  } from '/lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const focus = shouldWorkHaveFocus(ns);
    ns.singularity.workForCompany('Joe\'s Guns', focus);
    putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
    await ns.sleep(10000);
}

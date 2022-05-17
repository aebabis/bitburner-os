import { rmi } from './lib/rmi';
import { table } from './lib/table';
import { getPlayerData } from './lib/data-store';

const showContracts = (ns) => {
    const { contracts } = getPlayerData(ns);
    const rows = contracts.map(({ id, hostname, filename, type, tries }) =>
        [id, hostname, filename, type, tries]);
    ns.clearLog();
    ns.print(table(ns, ['ID', 'HOST', 'FILE', '', 'TRIES'], rows));
};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    while (true) {
        await ns.sleep(10000);
        await rmi(ns, true)('/bin/contracts/headhunter.js');
        await rmi(ns, true)('/bin/contracts/complete.js');
        showContracts(ns);
    }
}

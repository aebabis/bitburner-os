import { rmi } from '../../lib/rmi';
import { table } from '../../lib/table';
import { getContractData } from '../../lib/data-store';

const showContracts = (ns: NS) => {
  try {
    const { contracts } = getContractData(ns);
    const rows = contracts.map(({ id, hostname, filename, type, tries }) => [
      id,
      hostname,
      filename,
      type,
      tries,
    ]);
    ns.clearLog();
    ns.print(table(ns, ['ID', 'HOST', 'FILE', '', 'TRIES'], rows));
  } catch (error) {
    ns.tprint(error);
  }
};

export async function main(ns: NS) {
  ns.disableLog('ALL');
  while (true) {
    await ns.sleep(10000);
    await rmi(ns, true)('/bin/contracts/headhunter.ts');
    await rmi(ns, true)('/bin/contracts/complete.ts');
    showContracts(ns);
  }
}

import { table } from '../../lib/table';
import { getContractData } from '../../lib/data-store';

const showContracts = (ns: NS) => {
  const { contracts } = getContractData(ns);
  const rows = contracts.map(({ hostname, filename, type, tries }) => [
    hostname,
    filename,
    type,
    tries,
  ]);
  ns.clearLog();
  ns.tprint(table(ns, ['HOST', 'FILE', '', 'TRIES'], rows));
};

export async function main(ns: NS) {
  showContracts(ns);
}

import { nmap } from './lib/nmap';
import { table } from './lib/table';

type Contract = {
  filename: string;
  hostname: string;
  id: number;
  type: string;
};

export async function main(ns: NS) {
  ns.disableLog('ALL');
  const [query] = ns.args;
  let id = 1;
  const contracts: Contract[] = nmap(ns).flatMap((hostname) => {
    const serverContracts = ns
      .ls(hostname)
      .filter((file) => file.endsWith('.cct'));
    return serverContracts.map((filename) => ({
      filename,
      hostname,
      id: id++,
      type: ns.codingcontract.getContractType(filename, hostname),
    }));
  });

  if (query == null) {
    const rows = contracts.map(({ id, hostname, filename, type }) => [
      id,
      hostname,
      filename,
      type,
    ]);
    ns.tprint('\n' + table(ns, ['ID', 'HOST', 'FILE', ''], rows));
  } else {
    const match =
      typeof query === 'string'
        ? (cct: Contract) => cct.filename.includes(/** @type {string} */ query)
        : (cct: Contract) => cct.id == query;
    const contract = contracts.find(match);
    if (contract == null) {
      ns.tprint('No contracts match ' + query);
      return;
    }
    const { filename, hostname, type } = contract;
    const data = ns.codingcontract.getData(filename, hostname);
    const desc = ns.codingcontract.getDescription(filename, hostname);
    const tries = ns.codingcontract.getNumTriesRemaining(filename, hostname);
    ns.tprint(
      `\n${filename}  (${type}), ${tries} remaining\n${desc}\n${JSON.stringify(data)}`,
    );
  }
}

import {
  getHostnames,
  putContractData,
  getContractData,
  StoredContract,
} from '../../lib/data-store';
import { getSpawnChain } from '../../lib/service-api';

const isContract = (file: string) => file.endsWith('.cct');

const encode = <T>(data: T): string | T => (typeof data === 'bigint' ? `${data}n` : data);

const findContracts = (ns: NS): StoredContract[] => {
  const { contracts = [] } = getContractData(ns);
  return getHostnames(ns)
    .map((hostname) => {
      return ns
        .ls(hostname)
        .filter(isContract)
        .map((filename) => {
          const prevEntry = contracts.find((c) => c.filename === filename);
          const type = ns.codingcontract.getContractType(filename, hostname);
          const data = encode(ns.codingcontract.getData(filename, hostname));
          const tries = ns.codingcontract.getNumTriesRemaining(filename, hostname);
          const maxTries = prevEntry?.maxTries || tries;
          return { filename, hostname, type, data, tries, maxTries };
        });
    })
    .flat();
};

export async function main(ns: NS) {
  try {
    const { maxRam } = getSpawnChain(ns, '/bin/contracts/freelancer.ts');
    ns.ramOverride(maxRam);
    const contracts = findContracts(ns);
    putContractData(ns, { contracts });
    ns.spawn('/bin/contracts/complete.ts', { spawnDelay: 1 });
  } catch (error) {
    ns.tprint(error);
  }
}

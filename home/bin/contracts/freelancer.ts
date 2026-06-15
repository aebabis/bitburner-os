import { getHostnames } from '../../lib/data-store';
import { inPlace } from '../../lib/in-place';
import { table } from '../../lib/table';
import algorithms from './mapper';

const isContract = (file: string) => file.endsWith('.cct');

const getContracts = async (ns: NS) => {
  const files = getHostnames(ns).flatMap((hostname) =>
    ns
      .ls(hostname)
      .filter(isContract)
      .map((filename) => ({
        filename,
        hostname,
      })),
  );
  return Promise.all(
    files.map(async ({ filename, hostname }) => ({
      filename,
      hostname,
      type: await inPlace(ns).codingcontract['getContractType'](filename, hostname),
      data: await inPlace(ns).codingcontract['getData'](filename, hostname),
    })),
  );
};

const attemptContract = async (
  ns: NS,
  { filename, hostname, type, data }: ReturnType<typeof getContracts>[number],
) => {
  const algorithm = algorithms(type);
  if (algorithm == null) return null;
  const answer = algorithm(data);
  try {
    const outcome = await ns.codingcontract['attempt'](answer, filename, hostname);
    if (outcome === '')
      ns.tprint(
        'ERROR ' + algorithm.name + `(${JSON.stringify(data)}) => ${JSON.stringify(answer)}`,
      );
    else ns.tprint(outcome);
    return !!outcome;
  } catch (error) {
    ns.tprint('ERROR ' + error);
    return false;
  }
};

const failures = new Set<String>();

export async function main(ns: NS) {
  ns.disableLog('ALL');

  // Reserve highest cost RAM
  ns.codingcontract.attempt;

  const n = inPlace(ns);

  while (true) {
    const contracts = await getContracts(ns);
    for (const contract of contracts) {
      ns.tprint(contract);
      if (!failures.has(contract.filename)) {
        if (!(await attemptContract(n, contract))) {
          failures.add(contract.filename);
        }
      }
    }
    const rows = contracts.map(({ hostname, filename, type, tries }) => [
      hostname,
      filename,
      type,
      tries,
    ]);
    ns.clearLog();
    ns.print('\n' + table(ns, ['HOST', 'FILE', 'TYPE', 'TRIES'], rows));
    await ns.sleep(1000);
  }
}

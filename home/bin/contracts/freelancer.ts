import { getHostnames } from '../../lib/data-store';
import { inPlace } from '../../lib/in-place';
import { table } from '../../lib/table';
import algorithms from './mapper';

const isContract = (file: string) => file.endsWith('.cct');

type Contract = {
  filename: string;
  hostname: string;
  type: string;
  data: unknown;
  tries: number;
};

const getContracts = async (ns: NS) => {
  const results: Contract[] = [];
  for (const hostname of getHostnames(ns)) {
    for (const filename of ns.ls(hostname).filter(isContract)) {
      const type = await inPlace(ns).codingcontract['getContractType'](filename, hostname);
      const data = await inPlace(ns).codingcontract['getData'](filename, hostname);
      const tries = await inPlace(ns).codingcontract['getNumTriesRemaining'](filename, hostname);
      results.push({ hostname, filename, type, data, tries });
    }
  }
  return results;
};

const attemptContract = async (ns: NS, { filename, hostname, type, data }: Contract) => {
  const algorithm = algorithms(type as keyof typeof algorithms);
  if (algorithm == null) return null;
  const answer = algorithm(data as never); // No idea
  try {
    const outcome = await inPlace(ns).codingcontract['attempt'](answer, filename, hostname);
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

  while (true) {
    const contracts = await getContracts(ns);
    for (const contract of contracts) {
      if (!failures.has(contract.filename)) {
        try {
          if (!(await attemptContract(ns, contract))) {
            failures.add(contract.filename);
          }
        } catch (error) {
          ns.tprint(error);
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

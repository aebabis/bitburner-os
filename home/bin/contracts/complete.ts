import { getContractData, putContractData } from '../../lib/data-store';
import { getSpawnChain } from '../../lib/service-api';
import algorithms from './mapper';

const decode = (data: unknown) =>
  typeof data === 'string' && data.match(/^\d+n$/) ? BigInt(data.slice(0, -1)) : data;

const attemptContract = (
  ns: NS,
  /** @type {{filename: string, hostname: string, type: string, data: unknown}} */ {
    filename,
    hostname,
    type,
    data,
  },
) => {
  const algorithm = algorithms(type);
  if (algorithm == null) return null;
  const answer = algorithm(decode(data));
  try {
    // @ts-ignore -- returnReward option not in type definitions
    const outcome = ns.codingcontract.attempt(answer, filename, hostname, {
      returnReward: true,
    });
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

export async function main(ns: NS) {
  try {
    const { maxRam } = getSpawnChain(ns, '/bin/contracts/freelancer.ts');
    ns.ramOverride(maxRam);
    const { contracts = [], failedContractNames = [] } = getContractData(ns);
    const remainingContracts = [];
    for (const contract of contracts) {
      if (failedContractNames.includes(contract.filename)) continue;
      const result = attemptContract(ns, contract);
      if (!result) {
        remainingContracts.push(contract);
        if (result === false) failedContractNames.push(contract.filename);
      }
    }
    putContractData(ns, { contracts: remainingContracts, failedContractNames });
    ns.spawn('/bin/contracts/complete.ts', { spawnDelay: 1 });
  } catch (error) {
    console.error(error);
  }
}

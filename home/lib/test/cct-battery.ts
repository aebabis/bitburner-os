import { tprint } from '../../boot/util';
import { BRIGHT, ERROR } from '../../lib/colors';
import algorithms from '../../bin/contracts/mapper';
import { makeYielder } from '../util';

export async function main(ns: NS) {
  const [numEach = 1000] = ns.args as number[];

  ns.disableLog('ALL');

  tprint(ns)(BRIGHT.BOLD('TESTING CONTRACTS'));

  const contractNames = Object.values(ns.enums.CodingContractName);
  const unsupported = contractNames.filter((name) => algorithms(name) == null);
  const supported = contractNames.filter((name) => algorithms(name) != null);

  const yieldIfNeeded = makeYielder(ns);

  tprint(ns)(BRIGHT(`  Checking CodingContractName Coverage`));
  if (unsupported.length === 0) {
    tprint(ns)(BRIGHT(`    All known types supported`));
  } else {
    for (const cctType of unsupported) {
      tprint(ns)(ERROR(`    No solver found for "${cctType}"`));
    }
  }

  tprint(ns)(BRIGHT(`  Generating ${numEach} of each supported contract type`));
  if (supported.length === 0) {
    tprint(ns)(ERROR(`    No types supported`));
  } else {
    for (const cctType of supported) {
      tprint(ns)(BRIGHT(`    "${cctType}"`));
      let numRuns = 0;
      let numFails = 0;
      while (numRuns < numEach) {
        const name = ns.codingcontract.createDummyContract(cctType);
        if (name != null) {
          numRuns++;
          const data = ns.codingcontract.getData(name);
          const inputCopy = structuredClone(data);
          const algorithm = algorithms(cctType);
          const answer = algorithm(data as never);
          const result = ns.codingcontract.attempt(answer, name);
          if (result === '') {
            numFails++;
            if (numFails <= 10) {
              tprint(ns)(ERROR(`      ${algorithm.name}(${JSON.stringify(inputCopy)})`));
            }
          }
        }
        await yieldIfNeeded();
      }
      if (numFails === 0) {
        tprint(ns)(`      ${numRuns}/${numEach} runs passed`);
      } else {
        if (numFails > 10) {
          tprint(ns)(ERROR(`      (${numFails - 10} additional failures)`));
        }
        tprint(ns)(ERROR(`      ${numFails}/${numRuns} failed`));
      }
      await ns.sleep(0);
    }
  }
}

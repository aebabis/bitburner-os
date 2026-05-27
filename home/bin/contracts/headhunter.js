import {
  getHostnames,
  putContractData,
  getContractData,
} from '../../lib/data-store';

/** @typedef {{filename: string, maxTries?: number}} StoredContract */

const isContract = (/** @type {string} */ file) => file.endsWith('.cct');

const encode = (data) => (typeof data === 'bigint' ? `${data}n` : data);

/** @param {NS} ns */
const findContracts = (ns) => {
  const { contracts = /** @type {StoredContract[]} */ ([]) } =
    getContractData(ns);
  return getHostnames(ns)
    .map((hostname) => {
      return ns
        .ls(hostname)
        .filter(isContract)
        .map((filename) => {
          const prevEntry = contracts.find(
            (/** @type {StoredContract} */ c) => c.filename === filename,
          );
          const type = ns.codingcontract.getContractType(filename, hostname);
          const data = encode(ns.codingcontract.getData(filename, hostname));
          const tries = ns.codingcontract.getNumTriesRemaining(
            filename,
            hostname,
          );
          const maxTries = prevEntry?.maxTries || tries;
          return { filename, hostname, type, data, tries, maxTries };
        });
    })
    .flat();
};

/** @param {NS} ns */
export async function main(ns) {
  try {
    const contracts = findContracts(ns);
    putContractData(ns, { contracts });
  } catch (error) {
    ns.tprint(error);
  }
}

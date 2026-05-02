import {
  getHostnames,
  putContractData,
  getContractData,
} from "../../lib/data-store";

const isContract = (file) => file.endsWith(".cct");

const encode = (data) => (typeof data === "bigint" ? `${data}n` : data);

/** @param {NS} ns */
const findContracts = (ns) => {
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

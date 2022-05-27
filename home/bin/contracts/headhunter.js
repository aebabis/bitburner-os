import { getHostnames, putPlayerData } from './lib/data-store';

const isContract = file=>file.endsWith('.cct');

/** @param {NS} ns */
const findContracts = (ns) => {
    return getHostnames(ns).map((hostname) => {
        return ns.ls(hostname).filter(isContract).map((filename) => {
            const type = ns.codingcontract.getContractType(filename, hostname);
            const data = ns.codingcontract.getData(filename, hostname);
            const tries = ns.codingcontract.getNumTriesRemaining(filename, hostname);
            return { filename, hostname, type, data, tries };
        });
    }).flat();
};

/** @param {NS} ns */
export async function main(ns) {
    const contracts = findContracts(ns);
    putPlayerData(ns, { contracts });
}
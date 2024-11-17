import { getPlayerData, putPlayerData } from '/lib/data-store';
import algorithms from '/bin/contracts/mapper';

/** @param {NS} ns */
const attemptContract = (ns, { filename, hostname, type, data }) => {
    const algorithm = algorithms(type);
    if (algorithm == null)
        return null;
    const answer = algorithm(data);
    try {
        const outcome = ns.codingcontract.attempt(answer, filename, hostname, { returnReward: true });
        if (outcome === '')
            ns.tprint('ERROR ' + algorithm.name + `(${JSON.stringify(data)}) => ${JSON.stringify(answer)}`);
        else
            ns.tprint(outcome);
        return !!outcome;
    } catch (error) {
        ns.tprint('ERROR ' + error);
        return false;
    }
};

/** @param {NS} ns */
export async function main(ns) {
    const { contracts, failedContractNames=[] } = getPlayerData(ns);
    const remainingContracts = [];
    for (const contract of contracts) {
        if (failedContractNames.includes(contract.filename))
            continue;
        const result = attemptContract(ns, contract);
        if (!result) {
            remainingContracts.push(contract);
            if (result === false)
                failedContractNames.push(contract.filename)
        }
    }
    putPlayerData(ns, { contracts: remainingContracts, failedContractNames });
}

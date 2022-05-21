import { getPlayerData, putPlayerData } from './lib/data-store';
import algorithms from './bin/contracts/mapper';

/** @param {NS} ns */
const attemptContract = (ns, { filename, hostname, type, data, tries }) => {
    if (tries < 10)
        return false;
    const algorithm = algorithms(type);
    if (algorithm == null)
        return false;
    const answer = algorithm(data);
    try {
        const outcome = ns.codingcontract.attempt(answer, filename, hostname, { returnReward: true });
        if (outcome === '')
            ns.tprint('ERROR ' + algorithm.name + `(${data}) => ${answer}`);
        else
        ns.tprint(outcome);
        return !!outcome;
    } catch (error) {
        ns.tprint('ERROR ' + error);
    }
};

/** @param {NS} ns */
export async function main(ns) {
    let { contracts } = getPlayerData(ns);
    contracts = contracts.filter((contract) => !attemptContract(ns, contract));
    putPlayerData(ns, { contracts });
}
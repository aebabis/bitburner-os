import { nmap } from '/lib/nmap';
import { table } from '/lib/table';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    const [query] = ns.args;
    let id = 1;
    const contracts = nmap(ns).map((hostname) => {
        const serverContracts = ns.ls(hostname).filter(file=>file.endsWith('.cct'));
        return serverContracts.map((filename) => ({
            filename, hostname, id: id++,
            type: ns.codingcontract.getContractType(filename, hostname),
        }));
    }).flat();

    if (query == null) {
        const rows = contracts.map(({ id, hostname, filename, type }) => [id, hostname, filename, type]);
        ns.tprint('\n' + table(ns, ['ID', 'HOST', 'FILE', ''], rows));
    } else {
        const match = isNaN(query) ? cct=>cct.filename.includes(query) : cct => cct.id == query;
        const { filename, hostname, type } = contracts.find(match);
        const data = ns.codingcontract.getData(filename, hostname);
        const desc = ns.codingcontract.getDescription(filename, hostname);
        const tries = ns.codingcontract.getNumTriesRemaining(filename, hostname);
        ns.tprint(`\n${filename}  (${type}), ${tries} remaining\n${desc}\n${JSON.stringify(data)}`);
    }
}

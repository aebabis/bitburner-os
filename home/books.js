import { nmap } from './lib/nmap';
import { table } from './lib/table';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    const [query] = ns.args;
    let bin = 1;
    const books = nmap(ns).map((hostname) => {
        const serverBooks = ns.ls(hostname).filter(file=>file.endsWith('.lit'));
        return serverBooks.map((title) => ({
            title, hostname, bin: bin++,
        }));
    }).flat();

    if (query == null) {
        const rows = books.map(({ bin, hostname, title }) => [bin, hostname, title]);
        ns.tprint('\n' + table(ns, ['BIN', 'SERVER', 'TITLE'], rows));
    }
}

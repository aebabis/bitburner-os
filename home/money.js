import { nmap } from 'nmap';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    const script = ns.args[0];
    while (true) {
        const profitRate = ({ offlineMoneyMade, offlineRunningTime, onlineMoneyMade, onlineRunningTime }) =>
            (offlineMoneyMade + onlineMoneyMade) / (offlineRunningTime + onlineRunningTime);
        const ps = nmap(ns).map((hostname) => ns.ps(hostname)
            .filter(({filename}) => filename === script)
            .map(({ filename, args }) => ns.getRunningScript(filename, hostname, ...args)))
            .flat()
            .sort((a, b) => profitRate(b) - profitRate(a))
        ns.clearLog();
        const h1 = 'TARGET'.padEnd(20);
        const h2 = 'OFFLINE'.padEnd(10);
        const h3 = 'ONLINE'.padEnd(10);
        const h4 = 'TOTAL'.padEnd(10);
        const h5 = 'RATE';
        ns.print(`${h1} ${h2} ${h3} ${h4} ${h5}`);
        ps.forEach((process) => {
            const { offlineMoneyMade, offlineRunningTime, onlineMoneyMade, onlineRunningTime } = process;
            const args = process.args.join(' ').padEnd(20);
            const M = '$0.000a'
            const offline = ns.nFormat(offlineMoneyMade, M).padEnd(10);
            const online = ns.nFormat(onlineMoneyMade, M).padEnd(10);
            const total = ns.nFormat(offlineMoneyMade + onlineMoneyMade, M).padEnd(10);
            const rate = ns.nFormat(profitRate(process), M);
            ns.print(`${args} ${offline} ${online} ${total} ${rate}`);
        });
        await ns.sleep(5000);
    }
}
import { getPath } from './lib/backdoor.js';
import { getModalColumnCount } from './lib/modal';
import { renderWindows } from './lib/layout';
import { table } from './lib/table';
import { getServices } from './lib/service-api';
import { getStaticData, getMoneyData } from './lib/data-store';
import { THREADPOOL } from './etc/config';

const getSchedulerTable = (ns) => {
    const scheduler = ns.getRunningScript('/bin/scheduler.js', 'home');
    const {
        onlineExpGained,
        onlineMoneyMade,
        onlineRunningTime
    } = scheduler;
    const exp = ns.nFormat(onlineExpGained, '0.0a');
    const time = ns.nFormat(onlineRunningTime, '00:00:00');
    const moneyRate = ns.nFormat(onlineMoneyMade/onlineRunningTime, '$0.0a')+'/s';
    const { numPeopleKilled } = ns.getPlayer();
    return table(ns, ['STATS', { name: '', align: 'right'}],
        [['UPTIME', time],
        ['THEFT', moneyRate],
        ['KILLS', numPeopleKilled],
        ['EXP', exp]]);
};

const backdoorPath = (ns) => {
    const SPACES = ' '.repeat(' connect powerhouse-fitness '.length) + '\n';
    const HEAD = ' BACKDOOR HELPER \n';
    const path = getPath(ns);
    if (path == null) {
        return HEAD + ' (no available servers) ' + SPACES.repeat(2);
    } else {
        const text = path.map(s => s === 'home' ? ' home' : ` connect ${s} `).join('\n') + '\n backdoor';
        return HEAD + text;
    }
};

const tailLogs = (ns, width) => {
    width = Math.min(width, 80);
    return ns.getRunningScript('/bin/logger.js', 'home').logs
        .slice(-10).map(x=>x.split('\n')[0])
        .map(line => line.slice(line.indexOf(' ')+1))
        .map(line => line.length < width - 8 ? line : line.slice(0, width-8)+'...')
        .map(line => ` ${line} `)
        .map(line => line.padEnd(width - 6));
};

const process = (table) => typeof table === 'string' ? table.split('\n') : table;

const GB = 1000 ** 3;

const threadpoolRow = (ns, server) => {
	const { hostname, ramUsed, maxRam } = server;
    const n = hostname.split('-')[1]||'?';
	const ram = `${ns.nFormat(ramUsed*GB, '0b').padStart(5)}/${ns.nFormat(maxRam*GB, '0b').padEnd(5)}`;
	return [n, ram];
};

/** @param {NS} ns **/
const threadpools = (ns) => {
    const names = Array(ns.getPurchasedServerLimit()).fill(null)
        .map((_,i)=>(i+1).toString().padStart(2, '0'))
        .map(num =>`${THREADPOOL}-${num}`);
    return names
        .map(hostname=>{try{return ({
            hostname,
            ramUsed: ns.getServerUsedRam(hostname),
            maxRam: ns.getServerMaxRam(hostname),
        });}catch{return null}})
        .filter(Boolean)
        .map(server=>threadpoolRow(ns, server));
};

const threadpoolTable = (ns) => {
    const rows = threadpools(ns);
    const left = rows.slice(0, 12);
    const right = rows.slice(12);
    return table(ns, ['SERVERS', '', '', ''], 
        left.map((list, i) => [...list, ...(right[i]||['',''])]));
};

const goalsTable = (ns) => {
    const { targetFaction, neededAugmentations } = getStaticData(ns);
    if (neededAugmentations == null)
        return '';
    const rows = [
        ['Join ' + targetFaction],
        ...neededAugmentations[targetFaction].map(aug=>[aug]),
    ];
    return table(ns, ['GOALS'], rows);
};

const moneyTable = (ns) => {
    const moneyData = getMoneyData(ns);
    if (moneyData == null) {
        return ' INCOME\n(loading)';
    }
    const { income1s=0, income10s=0, income60s=0, costToAug=0, timeToAug } = moneyData;
    const rows = [
        [' 1s', ns.nFormat(income1s, '$0.0a').padStart(8)],
        ['10s', ns.nFormat(income10s, '$0.0a').padStart(8)],
        ['60s', ns.nFormat(income60s, '$0.0a').padStart(8)],
        ['Aug', ns.nFormat(costToAug||0, '$0.0a').padStart(8)],
        ['   ', ns.nFormat(timeToAug||100*60*60, '00:00:00').padStart(8)],
    ];
    return table(ns, ['', ' INCOME'], rows);
};

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    ns.tail();
    while (true) {
        const width = await getModalColumnCount(ns);
        if (width != null) {
            const text = [
                getSchedulerTable(ns),
                table(ns, ['SERVICES', ''], getServices(ns).map(({name, status})=>[name, status])),
                backdoorPath(ns),
                threadpoolTable(ns),
                goalsTable(ns),
                moneyTable(ns),
                tailLogs(ns, width),
            ].map(process);
            const textField = renderWindows(text, width);

            ns.clearLog();
            textField.split('\n').forEach(line=>ns.print(line));
        }
        await ns.sleep(1000);
    }
}

import { getPath } from './lib/backdoor.js';
import { getModalColumnCount } from './lib/modal';
import { renderWindows } from './lib/layout';
import { table } from './lib/table';
import { getServices } from './lib/planner-api';

const getSchedulerTable = (ns) => {
    const scheduler = ns.getRunningScript('/bin/scheduler.js', 'home', 'bootstrap');
    const {
        onlineExpGained,
        onlineMoneyMade,
        onlineRunningTime
    } = scheduler;
    const exp = ns.nFormat(onlineExpGained, '0.0a');
    const money = ns.nFormat(onlineMoneyMade, '$0.0a');
    const time = ns.nFormat(onlineRunningTime, '00:00:00');
    const moneyRate = ns.nFormat(onlineMoneyMade/onlineRunningTime, '$0.0a')+'/s';
    return table(ns, ['SCHEDULER', { name: '', align: 'right'}],
        [['UP', time], ['MONEY', money + '  '], ['', moneyRate], ['EXP', exp]]);
}

const backdoorPath = (ns) => {
    const SPACES = ' '.repeat(' connect powerhouse-fitness '.length) + '\n';
    const HEAD = ' BACKDOOR HELPER \n';
    const path = getPath(ns);
    if (path == null) {
        return HEAD + ' (no available servers) ' + SPACES.repeat(10);
    } else {
        const text = path.map(s => s === 'home' ? ' home' : ` connect ${s} `).join('\n') + '\n backdoor';
        return HEAD + SPACES.repeat(10 - path.length) + text;
    }
}

const tailLogs = (ns) => {
    return ns.getRunningScript('/bin/logger.js', 'home').logs.slice(-10).map(x=>x.split('\n')).flat().map(l => ` ${l} `);
}

const process = (table) => typeof table === 'string' ? table.split('\n') : table;

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
            tailLogs(ns),
            ].map(process);
            const textField = renderWindows(text, width);

            ns.clearLog();
            textField.split('\n').forEach(line=>ns.print(line));
        }
        await ns.sleep(1000);
    }
}
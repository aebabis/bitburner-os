import { table } from './lib/table';

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

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    ns.tail();
    while (true) {
        ns.clearLog();
        ns.print(getSchedulerTable(ns));
        await ns.sleep(100);
    }
}
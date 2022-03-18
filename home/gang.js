import { printTaskTable } from './bin/gang/task-table';
import { delegate } from './lib/scheduler-delegate';

/** @param {NS} ns **/
export async function main(ns) {
    const [command, ...args] = ns.args;

    if (command === 'tasks') {
        await printTaskTable(ns, args[0]);
    } else if (command === 'service') {
        delegate(ns)('/bin/gang/gang-controller.js', 'home');
    }
}
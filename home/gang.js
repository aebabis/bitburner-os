import { printTaskTable } from './bin/gang/task-table';

/** @param {NS} ns **/
export async function main(ns) {
    const [command, ...args] = ns.args;

    if (command === 'tasks') {
        await printTaskTable(ns, args[0]);
    }
}
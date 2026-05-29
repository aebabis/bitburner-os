import { printTaskTable } from './bin/gang/task-table';

export async function main(ns: NS) {
  const [command, ...args] = ns.args;

  if (command === 'tasks') {
    await printTaskTable(ns, args[0]);
  }
}

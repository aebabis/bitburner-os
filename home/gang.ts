import { printTaskTable } from './bin/gang/task-table';

export async function main(ns: NS) {
  const [command, ...args] = ns.args;

  if (command === 'tasks') {
    if (typeof args[0] === 'string' || typeof args[0] === 'boolean')
      throw new Error('Illegal argument');
    await printTaskTable(ns, args[0]);
  }
}

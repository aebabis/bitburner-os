import { table, transpose } from './lib/table';

export async function main(ns: NS) {
  const COLS = 4;

  const lines = ns
    .ls('home')
    .filter((file) => file.endsWith('.ts'))
    .map((script) => [script, ns.getScriptRam(script) + 'GB']);

  ns.tprint('\n' + table(ns, null, transpose(lines, COLS)));

  const schedulerRam = ns.getScriptRam('/bin/scheduler.ts');
  const plannerRam = ns.getScriptRam('/bin/planner.ts');

  const MAX_OS_RAM = 8 - 1.6;

  if (schedulerRam + plannerRam > MAX_OS_RAM) {
    ns.tprint(
      `ERROR - scheduler and planner exceed ${MAX_OS_RAM} GB in RAM (${sum}GB)`,
    );
  }
}

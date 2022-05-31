import { table, transpose } from './lib/table';

/** @param {NS} ns **/
export async function main(ns) {
    const COLS = 4;

    const lines = ns.ls('home')
        .filter(file=>file.endsWith('.js'))
        .map(script => [script, ns.getScriptRam(script) + 'GB']);

    ns.tprint('\n'+table(ns, null, transpose(lines, COLS)));

    const schedulerRam = ns.getScriptRam('/bin/scheduler.js');
    const plannerRam = ns.getScriptRam('/bin/planner.js');

    const MAX_OS_RAM = 8 - 1.6;

    if (schedulerRam + plannerRam > MAX_OS_RAM) {
        ns.tprint(`ERROR - scheduler and planner exceed ${MAX_OS_RAM} GB in RAM (${sum}GB)`);
    }
}
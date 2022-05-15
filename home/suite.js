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
    const loggerRam = ns.getScriptRam('/bin/logger.js');
    const sum = schedulerRam + plannerRam + loggerRam;
    if (sum > 8) {
        ns.tprint(`ERROR - scheduler, planner, and logger exceed 8GB in RAM (${sum}GB)`);
    }
}
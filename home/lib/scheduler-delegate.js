import { PORT_SCH_DELEGATE_TASK } from './etc/ports';
import { SCHEDULER_TMP } from './etc/config';
import { logger } from './logger';
import { uuid } from './lib/util';

// Fire-and-forget scheduler routines for
// tasks that don't need process info
// and want to save RAM

export const snippet = (statements) => `export async function main(ns) {\n${statements}\n}`;

/** @param {NS} ns **/
export const delegate = (ns) => async (script, host=null, numThreads=1, ...args) => {
    const sender = ns.getHostname();
    const message = JSON.stringify({ script, host, numThreads, args, sender, isDelegated: true });
    while (!await ns.tryWritePort(PORT_SCH_DELEGATE_TASK, message))
        await ns.sleep(50);
}

/** @param {NS} ns **/
export const delegateAny = (ns) => async (script, numThreads=1, ...args) =>
    delegate(script, null, numThreads, ...args);

/** @param {NS} ns **/
export const delegateAnonymous = (ns) => async(src, host=null, numThreads=1, ...args) => {
    const filename = SCHEDULER_TMP + uuid() + '.js';
    await ns.write(filename, src, 'w');
    return delegate(ns)(filename, host, numThreads, ...args);
}

/** @param {NS} ns **/
export const delegateAnonymousAny = (ns) => async (src, numThreads=1, ...args) =>
    delegateAnonymous(src, null, numThreads, ...args);

/** @param {NS} ns **/
export const getDelegatedTasks = async (ns) => {
	const port = ns.getPortHandle(PORT_SCH_DELEGATE_TASK);
    const tasks = [];
	while (!port.empty()) {
		const message = port.read();
		try {
            tasks.push(JSON.parse(message))
		} catch(error) {
			await logger(ns).error(error) // TODO: Pretty
		}
	}
    return tasks;
}
import { PORT_SCH_DELEGATE_TASK, PORT_SCH_RETURN } from './etc/ports';
import { SCHEDULER_TMP } from './etc/config';
import { logger } from './logger';
import { uuid } from './lib/util';
import Ports from './lib/ports';

// Fire-and-forget scheduler routines for
// tasks that don't need process info
// and want to save RAM

export const snippet = (statements) => `export async function main(ns) {\n${statements}\n}`;

/** @param {NS} ns **/
export const delegate = (ns, response, options={}) => async (script, host=null, numThreads=1, ...args) => {
    const {reap} = options;
    const ticket = response ? uuid() : undefined;
    const sender = ns.getHostname();
    const message = JSON.stringify({
        script, host, numThreads, args, sender, ticket, reap, isDelegated: true });
    while (!await ns.tryWritePort(PORT_SCH_DELEGATE_TASK, message))
        await ns.sleep(50);
    await ns.sleep(50);
    if (response) {
        const port = Ports(ns).getPortHandle(PORT_SCH_RETURN);
        while (true) {
            const job = port.peek();
            if (job != null) {
                if (job.ticket === ticket) {
                    return port.read();
                } else if (Date.now() - job.timestamp > 200) {
                    port.read();
                }
            }
            await ns.sleep(10);
        }
    }
}

/** @param {NS} ns **/
export const delegateAny = (ns, response, options) => async (script, numThreads=1, ...args) =>
    await delegate(ns, response, options)(script, null, numThreads, ...args);

/** @param {NS} ns **/
export const delegateAnonymous = (ns, response) => async(src, host=null, numThreads=1, ...args) => {
    const filename = SCHEDULER_TMP + uuid() + '.js';
    await ns.write(filename, src, 'w');
    return delegate(ns, response, { reap: true })(filename, host, numThreads, ...args);
}

/** @param {NS} ns **/
export const delegateAnonymousAny = (ns, response) => async (src, numThreads=1, ...args) =>
    await delegateAnonymous(ns, response)(src, null, numThreads, ...args);

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

/** @param {NS} ns **/
export const closeTicket = (ns) => async (ticket, pid, hostname, threads) => {
    const port = Ports(ns).getPortHandle(PORT_SCH_RETURN);
    while (port.full()) {
        await ns.sleep(50);
    }

    const timestamp = Date.now();
    port.write({ ticket, pid, hostname, threads, timestamp });
}
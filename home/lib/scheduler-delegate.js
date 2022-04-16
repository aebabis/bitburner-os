import { PORT_SCH_DELEGATE_TASK, PORT_SCH_RETURN } from './etc/ports';
// import { SCH_TMP_DIR } from './etc/config';
import Ports from './lib/ports';
import { logger } from './lib/logger';

export const snippet = (statements) => `export async function main(ns) {\n${statements}\n}`;

/** @param {NS} ns **/
export const delegate = (ns, response, options={}) => async (script, host=null, numThreads=1, ...args) => {
    if (!script.endsWith('.js') || isNaN(numThreads) || numThreads < 1) {
        if (host == null) {
            throw new Error(`Illegal process description: ${script} ${numThreads} ${args.join(' ')}`);
        } else {
            throw new Error(`Illegal process description: ${script} ${host} ${numThreads} ${args.join(' ')}`);
        }
    }
    // const {reap} = options;
    const ticket = response ? crypto.randomUUID() : undefined;
    const sender = ns.getHostname();
    const message = JSON.stringify({
        script, host, numThreads, args, sender, ticket, requestTime: Date.now() });
    let start = Date.now();
    while (!await ns.tryWritePort(PORT_SCH_DELEGATE_TASK, message) && Date.now() - start < 60000)
        // Timeout occurs if scheduler restarts
        await ns.sleep(50);
    if (response) {
        await ns.sleep(50);
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
            if (Date.now() - start >= 60000) {
                throw new Error(`Timed-out: ${script} ${host||'*'} ${numThreads} ${args.join(' ')}`);
            }
        }
    }
}

/** @param {NS} ns **/
export const delegateAny = (ns, response, options) => async (script, numThreads=1, ...args) =>
    await delegate(ns, response, options)(script, null, numThreads, ...args);

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
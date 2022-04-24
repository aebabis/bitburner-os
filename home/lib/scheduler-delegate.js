import { PORT_SCH_DELEGATE_TASK, PORT_SCH_RETURN } from './etc/ports';
import Ports from './lib/ports';
import { logger } from './lib/logger';

export const snippet = (statements) => `export async function main(ns) {\n${statements}\n}`;

const desc = (script, host=null, numThreads=1, ...args) => host == null ?
    `${script} ${numThreads} ${args.join(' ')}` : `${script} ${host} ${numThreads} ${args.join(' ')}`;

const Job = (ns, response, startTime) => (script, host=null, numThreads=1, ...args) => {
    if (!script.endsWith('.js') || isNaN(numThreads) || numThreads < 1) {
        throw new Error(`Illegal process description: ${desc(script, host, numThreads, ...args)}`);
    }
    const ticket = response ? crypto.randomUUID() : undefined;
    return { script, host, numThreads, args, ticket, startTime, requestTime: Date.now() };
}

/** @param {NS} ns **/
export const delegate = (ns, response, options={}) => async (script, host=null, numThreads=1, ...args) => {
    const { startTime = Date.now() } = options;
    const job = Job(ns, response, startTime)(script, host, numThreads, ...args);
    const port = Ports(ns).getPortHandle(PORT_SCH_DELEGATE_TASK);
    await port.blockingWrite(job);
    if (response) {
        const start = Date.now();
        await ns.sleep(50);
        const port = Ports(ns).getPortHandle(PORT_SCH_RETURN);
        while (true) {
            const process = port.peek();
            if (process != null) {
                if (process.ticket === job.ticket) {
                    return port.read();
                } else if (Date.now() - process.timestamp > 200) {
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

export const createBatch = (ns) => {
    let jobs = [];
    const delegate = (startTime) => (script, host=null, numThreads=1, ...args) => jobs.push(Job(ns, false, startTime)(script, host, numThreads, ...args));
    return {
        delegate,
        delegateAny: (startTime) => (script, numThreads=1, ...args) => delegate(startTime)(script, null, numThreads, ...args),
        getSize: () => jobs.length,
        send: async() => Ports(ns).getPortHandle(PORT_SCH_DELEGATE_TASK).blockingWrite(jobs),
    };
}

/** @param {NS} ns **/
export const getDelegatedTasks = async (ns) => {
	const port = Ports(ns).getPortHandle(PORT_SCH_DELEGATE_TASK);
    const tasks = [];
	while (!port.empty()) {
		const messages = [port.read()].flat(Infinity);
		try {
            tasks.push(...messages);
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
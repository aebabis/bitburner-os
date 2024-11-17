import { logger } from '/lib/logger';
import { getDelegatedTasks, closeTicket } from '/lib/scheduler-delegate';
import { HACK, GROW, WEAKEN, SHARE } from '/etc/filenames';
import { ERROR } from '/lib/colors';
const WORKERS = [HACK, GROW, WEAKEN, SHARE];

const TicketItem = ({ script, host, numThreads, args, ...rest }) => {
	const time = rest.startTime || Date.now();
	const waitTime = () => Date.now() - time;
	const wait = () => (waitTime()/1000).toFixed(3);
	const isWorker = WORKERS.includes(script);
	return {
		...rest,
		script, host, numThreads, args,
		time, waitTime, isWorker,
		toString: (hostname) => `${script} ${hostname || host} ${numThreads} ${args.join(' ')} (${wait()}s)`,
	};
};

/** @param {NS} ns **/
export const checkPort = async (ns, queue) => {
	const delegated = (await getDelegatedTasks(ns));
	for (const taskData of delegated) {
		const { script, ticket }  = taskData;
		if (ns.getScriptRam(script, 'home') === 0) {
			logger(ns).error(`Scheduler received task for non-existant script: ${script}`);
			await closeTicket(ns, ticket);
		}
		else
			queue.push(TicketItem(taskData));
	}
};
	
/** @param {NS} ns **/
export const fulfill = async (ns, process, server) => {
	const { hostname, ramAvailableTo } = server;
	const { script, numThreads, args, ticket } = process;
	const scriptRam = ns.getScriptRam(script, 'home');
	const maxThreads = Math.floor(ramAvailableTo(process) / scriptRam);
	const threads = Math.min(numThreads, maxThreads);
	if (threads === 0)
		return reject(ns, process, 'Scheduler tried to run: ' + process.toString() + ' on ' + hostname);
	const pid = ns.exec(script, hostname, threads, ...args);
	if (pid === 0)
		return reject(ns, process, 'Unable to start process: ' + process.toString(hostname));
	if (ticket != null)
		await closeTicket(ns)(ticket, pid, hostname, threads);
};

/** @param {NS} ns **/
export const reject = async (ns, process, reason) => {
	if (reason != null)
		ns.tprint(ERROR + reason);
	if (process.ticket != null)
		await closeTicket(ns)(process.ticket, 0, null, 0);
};

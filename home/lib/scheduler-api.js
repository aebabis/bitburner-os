import { logger } from './lib/logger';
import { getDelegatedTasks, closeTicket } from './lib/scheduler-delegate';

const TicketItem = ({ script, host, numThreads, args, sender, messageFilename, ...rest }) => {
	const time = Date.now();
	const waitTime = () => Date.now() - time;
	const wait = () => (waitTime()/1000).toFixed(3);
	return {
		...rest,
		script, host, numThreads, args,
		sender, messageFilename,
		time, waitTime,
		toString: (hostname) => `${script} ${hostname || host} ${numThreads} ${args.join(' ')} (${wait()}s)`,
	};
}

/** @param {NS} ns **/
export const checkPort = async (ns, queue) => {
	const delegated = (await getDelegatedTasks(ns))
	for (const taskData of delegated) {
		const { script, sender, ticket }  = taskData;
		if (ns.getScriptRam(script, sender) === 0) {
			logger(ns).error(`Scheduler received task for non-existant script: ${sender}~${script}`);
			await closeTicket(ns, ticket);
		}
		else
			queue.push(TicketItem(taskData));
	}
}
	
/** @param {NS} ns **/
export const fulfill = async (ns, process, server) => {
	const { hostname, ramAvailable } = server;
	const { script, numThreads, args, sender, ticket, requestTime } = process;
	const scriptRam = ns.getScriptRam(script, sender);
	const maxThreads = Math.floor(ramAvailable / scriptRam);
	const threads = Math.min(numThreads, maxThreads);
	let pid = 0;
	if (threads > 0) {
		pid = ns.exec(script, hostname, threads, ...args);
		if (pid === 0) {
			logger(ns).error('Unable to start process: ' + process.toString(hostname))
		}
	} else {
		logger(ns).error('Scheduler tried to run: ' + process.toString());
		return reject(ns, process);
	}
	if (ticket != null) {
		const waitTime = Date.now() - requestTime;
		if (waitTime > 25)
			ns.tprint('WARN - process waited ' + waitTime + 'ms');
		await closeTicket(ns)(ticket, pid, hostname, threads);
	}
}

/** @param {NS} ns **/
export const reject = async (ns, process) => {
	if (process.ticket != null)
		await closeTicket(ns)(process.ticket, 0, null, 0);
}
import { SCH_TMP_DIR } from './etc/config';
import { logger } from './logger';
import { getDelegatedTasks, closeTicket } from './lib/scheduler-delegate';

const filePids = {};
export const clean = (() => {
	const timestamps = {};
	let lastRun = 0;
	/** @param {NS} ns **/
	return (ns) => {
		if (Date.now() - lastRun < 1000)
			return;
		lastRun = Date.now();
		ls('home', SCH_TMP_DIR).forEach((filename) => {
			const pid = filePids[filename];
			const time = timestamps[filename];
			if (pid != null) {
				if (ns.rm(filename)) {
					delete filePids[pid];
				}
			} else if (time == null) {
				timestamps[filename] = Date.now();
			} else if (Date.now() - time > 60000) {
				if (ns.rm(filename)) {
					delete timestamps[filename];
				}
			}
		})
	}
})

const TicketItem = ({ script, host, numThreads, args, sender, messageFilename, ...rest }) => {
	const time = Date.now();
	const waitTime = () => Date.now() - time;
	const wait = () => (waitTime()/1000).toFixed(3);
	return {
		...rest,
		script, host, numThreads, args,
		sender, messageFilename,
		time, waitTime,
		toString: () => `${script} ${host} ${numThreads} ${args.join(' ')} (${wait()}s)`,
	};
}

/** @param {NS} ns **/
export const checkPort = async (ns, queue) => {
	const delegated = (await getDelegatedTasks(ns))
	delegated.forEach(data => queue.push(TicketItem(data)));
}
	
/** @param {NS} ns **/
export const fulfill = async (ns, process, hostname) => {
	const { script, numThreads, args, sender, ticket } = process;
	const scriptRam = ns.getScriptRam(script, sender);
	const ramAvailable = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname);
	const maxThreads = Math.floor(ramAvailable / scriptRam);
	const threads = Math.min(numThreads, maxThreads);
	let pid = 0;
	if (threads > 0) {
		// TODO: Copy the script to server first
		// if (sender !== hostname && hostname !== 'home' && !ns.fileExists(script, hostname))
		// 	await ns.scp(script, sender, hostname);
		pid = ns.exec(script, hostname, threads, ...args);
		if (pid !== 0 && process.reap) {
			filePids[script] = pid;
		}
	} else {
		logger(ns).error('Scheduler tried to run: ', script, hostname, threads+'/'+numThreads, ...args);
		// logger(ns).error('                        ', ns.getScriptRam(script, sender), ramAvailable);
		return reject(ns, process);
	}
	if (ticket != null)
		await closeTicket(ns)(ticket, pid, hostname, threads);
}

/** @param {NS} ns **/
export const reject = async (ns, process) => {
	if (process.ticket != null)
		await closeTicket(ns)(process.ticket, 0, null, 0);
}
import { PORT_SCH_REQUEST_THREADS } from './etc/ports';
import { SCHEDULER_TMP } from './etc/config';
import { uuid } from './lib/util';
import { logger } from './logger';
import { getDelegatedTasks } from './lib/scheduler-delegate';

const CANCELLED = '0';
const JOB_TIMEOUT = 60 * 1000 * 5;

const getTicket = () => SCHEDULER_TMP + uuid() + '.txt';

/** @param {NS} ns **/
const ticketComplete = async (ns, ticket) => {
	let txt;
	const start = Date.now();
	let delay = 1;
	// await systemLog(ns, 'WAIT', ticket);
	while ((txt = await ns.read(ticket)) === '') {
		await ns.sleep(delay);
		delay <<= 1;
		if (Date.now() - start > JOB_TIMEOUT) {
			// TODO: Give caller a choice
			throw new Error('Ticket probably dead');
		}
	}
	ns.rm(ticket);
	// await systemLog(ns, 'RECV', ticket);
	if (txt === CANCELLED)
		throw new Error('Job cancelled');
	return JSON.parse(txt);
}

const sendToScheduler = async (ns, message) => {
	while (!ns.getPortHandle(PORT_SCH_REQUEST_THREADS).tryWrite(JSON.stringify(message)))
		await ns.sleep(100);
}

/** @param {NS} ns **/
export const exec = (ns, beforeRun) => async(script, host=ns.getHostname(), numThreads=1, ...args) => {
	const messageFilename = getTicket();
	const sender = ns.getHostname();
	await sendToScheduler(ns, { script, host, numThreads, args, messageFilename, sender });
	// await systemLog(ns, 'SEND', script, messageFilename);
	const { hostname, ram } = await ticketComplete(ns, messageFilename);
	// await systemLog(ns, hostname, ram);
	if (beforeRun != null)
		await beforeRun(hostname);
	const threads = Math.floor(ram / ns.getScriptRam(script, host));
	ns.tprint(script + ' ' + hostname + ' ' + threads + ' ' + args);
	const pid = ns.exec(script, hostname, threads, ...args);
	return { pid, hostname, threads };
}

/** @param {NS} ns **/
export const execAnyHost = (ns, beforeRun) => async(script, numThreads=1, ...args) => {
	const messageFilename = getTicket();
	const sender = ns.getHostname();
	await sendToScheduler(ns, { script, host: null, numThreads, args, messageFilename, sender });
	const { hostname, ram } = await ticketComplete(ns, messageFilename);
	if (!ns.fileExists(script, hostname)) {
		await ns.scp(script, hostname);
	}
	if (beforeRun != null)
		await beforeRun(hostname);
	const threads = Math.floor(ram / ns.getScriptRam(script, hostname));
	const pid = ns.exec(script, hostname, threads, ...args);
	return { pid, hostname, threads };
}

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
	const port = ns.getPortHandle(PORT_SCH_REQUEST_THREADS);
	while (!port.empty()) {
		const message = port.read();
		try {
			queue.push(TicketItem(JSON.parse(message)));
		} catch(error) {
			await logger(ns).error(error); // TODO: Pretty
		}
	}
	const delegated = (await getDelegatedTasks(ns))
	delegated.forEach(data => queue.push(TicketItem(data)));
}

/** @param {NS} ns **/
const write = async (ns, filename, content, host) => {
	await ns.write(filename, content, 'w');
	if (host != ns.getHostname()) {
		await ns.scp(filename, host);
		ns.rm(filename);
	}
}

export const clean = (() => {
	// let msgs = ns.ls(SCHEDULER_HOME, '/msg/')
	// for (const file of msgs)
	// 	await ns.write(file, CANCELLED, 'w');
	// await ns.sleep(200);
	// msgs = ns.ls(SCHEDULER_HOME, '/msg/')
	// for (const file of msgs)
	// 	ns.rm(file);

	const timestamps = {};
	let lastRun = 0;
	/** @param {NS} ns **/
	return (ns) => {
		if (Date.now() - lastRun < 1000)
			return;
		lastRun = Date.now();
		ls('home', SCHEDULER_TMP).forEach((filename) => {
			const time = timestamps[filename];
			if (time == null) {
				timestamps[filename] = Date.now();
			} else if (Date.now() - time > JOB_TIMEOUT) {
				ns.rm(filename);
				ns.print('JOB CANCELLED: ' + filename);
				delete timestamps[filename];
			}
		})
	}
})
	
/** @param {NS} ns **/
export const fulfill = async (ns, process, server) => {
	const { hostname } = server;
	if (!process.isDelegated) {
		const { script, messageFilename, sender, numThreads } = process;
		const processRam = ns.getScriptRam(script, sender) * numThreads;
		const ram = Math.min(processRam, ns.getServerMaxRam(hostname));
		const message = JSON.stringify({ hostname, ram });
		await write(ns, messageFilename, message, sender);
	} else {
		const { script, numThreads, args, sender } = process;
		// TODO: Copy the script to server first
		if (sender !== hostname && hostname !== 'home')
			await ns.scp(script, sender, hostname);
		ns.exec(script, hostname, numThreads, ...args);
	}
}

/** @param {NS} ns **/
export const reject = async (ns, process) => {
	if (!process.isDelegated) {
		const { messageFilename, sender } = process;
		await write(ns, messageFilename, CANCELLED, sender);
	} else {
		// Delegated processes have no return address
	}
}
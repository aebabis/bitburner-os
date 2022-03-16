import { PORT_SCHEDULER } from './etc/ports';
import { uuid } from './lib/util';

const CANCELLED = '0';
const JOB_TIMEOUT = 60 * 1000 * 5;
const SCHEDULER_DIR = '/run/sch/';

const getTicket = () => SCHEDULER_DIR + uuid() + '.txt';

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
	while (!ns.getPortHandle(PORT_SCHEDULER).tryWrite(JSON.stringify(message)))
		await ns.sleep(100);
}

/** @param {NS} ns **/
export const exec = (ns) => async(script, host=ns.getHostname(), numThreads=1, ...args) => {
	const messageFilename = getTicket();
	const sender = ns.getHostname();
	await sendToScheduler(ns, { script, host, numThreads, args, messageFilename, sender });
	// await systemLog(ns, 'SEND', script, messageFilename);
	const { hostname, ram } = await ticketComplete(ns, messageFilename);
	// await systemLog(ns, hostname, ram);
	const threads = Math.floor(ram / ns.getScriptRam(script, host));
	const pid = ns.exec(script, hostname, threads, ...args);
	return { pid, hostname, threads };
}

/** @param {NS} ns **/
export const execAnyHost = (ns) => async(script, numThreads=1, ...args) => {
	const messageFilename = getTicket();
	const sender = ns.getHostname();
	await sendToScheduler(ns, { script, host: null, numThreads, args, messageFilename, sender });
	const { hostname, ram } = await ticketComplete(ns, messageFilename);
	if (!ns.fileExists(script, hostname)) {
		await ns.scp(script, hostname);
	}
	const threads = Math.floor(ram / ns.getScriptRam(script, hostname));
	const pid = ns.exec(script, hostname, threads, ...args);
	return { pid, hostname, threads };
}

/** @param {NS} ns **/
export const checkPort = async (ns, queue) => {
	const port = ns.getPortHandle(PORT_SCHEDULER);
	while (!port.empty()) {
		const message = port.read();
		try {
			const { script, host, numThreads, args, sender, messageFilename, ...rest } = JSON.parse(message);
			const time = Date.now();
			const waitTime = () => Date.now() - time;
			const wait = () => ns.tFormat(waitTime());
			const getRam = () => ns.getScriptRam(script, sender) * numThreads;
			// if (getRam() > ns.getPurchasedServerMaxRam()) {
				// await systemLog(ns, `Cancelling Process Because Impossible RAM`);
			// 	await write(ns, messageFilename, CANCELLED, sender);
			// 	continue;
			// }
			queue.push({
				...rest,
				script, host, numThreads, args,
				sender,
				time,
				waitTime,
				getRam,
				messageFilename,
				getScriptRam: () => ns.getScriptRam(script, sender),
				toString: () => `${script} ${host} ${numThreads} ${args.join(' ')} (${wait()})`,
			});
		} catch(error) {
			ns.print('ERROR ' + error.message); // TODO: Pretty
		}
	}
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
	return (ns) => {
		if (Date.now() - lastRun < 1000)
			return;
		lastRun = Date.now();
		const ls = ns.ls('home');
		Object.entries(timestamps).forEach(([filename, time]) => {
			if (!ls.includes(filename)) {
				delete timestamps[filename];
			} else if (Date.now() - time > JOB_TIMEOUT) {
				ns.rm(filename);
				ns.print('JOB CANCELLED: ' + filename);
			}
		})
	}
})
	
/** @param {NS} ns **/
export const fulfill = async (ns, process, server) => {
	const { messageFilename, sender } = process;
	const { hostname } = server;
	const ram = Math.min(process.getRam(), ns.getServerMaxRam(hostname));
	const message = JSON.stringify({ hostname, ram });
	await write(ns, messageFilename, message, sender);
}

/** @param {NS} ns **/
export const reject = async (ns, process) => {
	const { messageFilename, sender } = process;
	await write(ns, messageFilename, CANCELLED, sender);
}
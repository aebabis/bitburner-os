import { PORTS } from './etc/ports';
import { by } from './lib/util';

const SCHEDULER_HOME = 'home';
const CANCELLED = '0';
const THREADPOOL_NAME = 'THREADPOOL';
const JOB_TIMEOUT = 60 * 1000 * 5;
const SCHEDULER_DIR = '/run/sch/';

const getTicket = () => SCHEDULER_DIR + (+Math.random().toString().slice(2)).toString(16) + '.txt';

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

const queue = [];

const sendToScheduler = async (ns, message) => {
	while (!ns.getPortHandle(PORTS.SCHEDULER).tryWrite(JSON.stringify(message)))
		await ns.sleep(100);
}

export const uuid = () => Math.random().toString().slice(2).toString(16);

/** @param {NS} ns **/
export const exec = (ns) => async(script, host=ns.getServer().hostname, numThreads=1, ...args) => {
	const messageFilename = getTicket();
	const sender = ns.getServer().hostname;
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
	const sender = ns.getServer().hostname;
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
const checkPort = async (ns) => {
	const port = ns.getPortHandle(PORTS.SCHEDULER);
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

const showQueue = (ns) => {
	queue.forEach(item => ns.print(item.toString()));
}

const timestamps = {};
/** @param {NS} ns **/
const write = async (ns, filename, content, host) => {
	timestamps[filename] = Date.now();
	// await systemLog(ns, 'RESP', filename, content, host);
	await ns.write(filename, content, 'w');
	if (host != ns.getServer().hostname) {
		await ns.scp(filename, host);
		ns.rm(filename);
	}
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

const handle = (hostname, ram) => JSON.stringify({ hostname, ram });

/** @param {NS} ns **/
const fulfill = async (ns, process, server) => {
	const { messageFilename, sender } = process;
	const ram = Math.min(process.getRam(), ns.getServerMaxRam(server.hostname));
	await write(ns, messageFilename, handle(server.hostname, ram), sender);
}

let serversMaxedOut = false;

/** @param {NS} ns **/
const purchaseThreadpoolServer = (ns) => {
	const money = ns.getServerMoneyAvailable('home');
	const servers = ns.getPurchasedServers()
		.map(ns.getServer)
		.sort(by(s=>s.maxRam));
	if (servers.length === ns.getPurchasedServerLimit()) {
		const smallest = servers.shift();
		const biggest  = servers.pop();
		const lowerLimit = smallest.maxRam * 2;
		const upperLimit = biggest.maxRam * 2;

		if (smallest.ram === ns.getPurchasedServerMaxRam()) {
			serversMaxedOut = true;
			return false;
		}
		
		let ram = upperLimit;
		while (ram >= lowerLimit && ram <= ns.getPurchasedServerMaxRam()) {
			const cost = ns.getPurchasedServerCost(ram);
			if (cost <= money) {
				// ns.tprint('Killing ' + smallest.hostname + ' ' + smallest.maxRam);
				ns.killall(smallest.hostname);
				ns.deleteServer(smallest.hostname);
				return ns.purchaseServer(THREADPOOL_NAME, ram);
			} else {
				ram >>= 1;
			}
		}
	} else {
		// If not maxed, buy the best server we can afford
		const ram = ns.getPurchasedServerMaxRam();
		while (ns.getPurchasedServerCost(ram) > money) {
			ram >>= 1;
			if (ram < 2)
				return;
		}
		return ns.purchaseServer(THREADPOOL_NAME, ram);
	}
}

/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog('ALL');
	if (ns.args[0] != null) {
		switch(ns.args[0]) {
			case 'ls':
				showQueue(ns);
				return;
			case 'schedule':
				return exec(ns)(...ns.args.slice(1));
			case 'grow-pool':
				const hostname = purchaseThreadpoolServer(ns);
				if (hostname != null) {
					ns.tprint(hostname + '    ' + ns.getServer(hostname).maxRam);
				}
				return;
			case 'cleaner':
				let lastBatch = [];
				while (true) {
					let currentBatch = ns.ls(SCHEDULER_HOME, SCHEDULER_DIR);
					currentBatch.forEach((file) => {
						if (lastBatch.includes(file)) {
							ns.rm(file);
						}
					});
					lastBatch = currentBatch;
					await ns.sleep(10000);
				}
				return;
			case 'restart':
				ns.kill(ns.getScriptName(), SCHEDULER_HOME);
				ns.exec(ns.getScriptName(), SCHEDULER_HOME);
				return;
			default:
				throw new Error(`Unrecognized command: ${ns.args[0]}`);
		}
	} else if (ns.getServer().hostname !== SCHEDULER_HOME){
		throw new Error(`Scheduler only runs on ${SCHEDULER_HOME}`);
	}

	let msgs = ns.ls(SCHEDULER_HOME, SCHEDULER_DIR)
	for (const file of msgs)
		await ns.write(file, CANCELLED, 'w');
	await ns.sleep(200);
	msgs = ns.ls(SCHEDULER_HOME, SCHEDULER_DIR)
	for (const file of msgs)
		ns.rm(file);

	while (true) {
		try {
			await checkPort(ns);
			if (queue.length === 0) {
				await ns.sleep(100);
				continue;
			}

			queue.sort(by(job=>job.numThreads/(1 << job.waitTime())));
			for (let i = 0; i < Math.ceil(queue.length / 2); i++) {
				const process = queue[i];
				// await systemLog(ns, process);
				if (process.waitTime() > 60000) {
					const { messageFilename, sender } = process;
					await write(ns, messageFilename, CANCELLED, sender);
					queue.splice(i, 1);
					i--;
					continue;
				}
				const ramRequired = process.getRam();
				if (process.host != null) {
					// Specific server requested
					const { maxRam, ramUsed } = ns.getServer(process.host);
					if (ramRequired < (maxRam - ramUsed)) {
						// await systemLog(ns, 'APPR', process.script, process.messageFilename);
						await fulfill(ns, queue.splice(i, 1)[0], ns.getServer(process.host));
						continue;
					}
				} else {
					// No preference; choose
					const availableRam = ({ hostname, maxRam, ramUsed }) => {
						if (hostname === 'home')
							return maxRam/2 - ramUsed;
						else
							return maxRam - ramUsed;
					}
					const servers = ['home', ...ns.getPurchasedServers()]
						.map(ns.getServer)
						.sort(by(availableRam));
					const numServers = servers.length;
					if (!serversMaxedOut && numServers + 2 > ns.getPurchasedServerLimit()) {
						// Free smallest servers so they can
						// be deleted for bigger ones
						servers.shift();
						servers.shift();
					}
					const server = servers.find(server => availableRam(server) >= ramRequired);
					if (server != null) {
						const { messageFilename, sender } = queue.shift();
						await write(ns, messageFilename, handle(server.hostname, ramRequired), sender);
					} else {
						const ramToBuy = 1 << Math.ceil(Math.log2(ramRequired));
						const settleServer = servers[servers.length - 1];
						const ram = availableRam(settleServer);
						let hostname;
						if (ram > ramToBuy) {
							await fulfill(ns, queue.shift(), settleServer);
						} else if (hostname = purchaseThreadpoolServer(ns)) {
							await fulfill(ns, queue.shift(), ns.getServer(hostname));
						} else if (ram > process.getScriptRam()) {
							await fulfill(ns, queue.shift(), settleServer);
						}
					}
					continue;
				}
			}
			ns.clearLog();
			if (queue.length > 0) {
				showQueue(ns);
			}
			await ns.sleep(1);
		} catch(error) {
			if (error instanceof Error)
				ns.print('ERROR ' + error);
			else
				ns.print('ERROR ' + typeof error + ' ' + error);
			await ns.sleep(1000);
		}
	}
}
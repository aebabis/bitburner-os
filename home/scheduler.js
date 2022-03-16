import { by } from './lib/util';
import { checkPort, clean, fulfill, reject } from './lib/scheduler-api';

const SCHEDULER_HOME = 'home';

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

	const queue = [];
	while (true) {
		try {
			clean(ns);
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
					await reject(ns, queue.splice(i--, 1)[0]);
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

					const purchasedServers = ns.getPurchasedServers().map(ns.getServer);
					const ramLimit = ns.getPurchasedServerMaxRam();
					const serversMaxedOut = purchasedServers.every(server=>server.maxRam===ramLimit);
					const servers = [ns.getServer('home'), ...purchasedServers]
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
						await fulfill(ns, queue.shift(), server);
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
					queue.forEach(item => ns.print(item.toString()));
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
import { PORT_SCH_RAM_DATA } from './etc/ports';
import Ports from './lib/ports';
import { by } from './lib/util';
import { nmap } from './lib/nmap';
import { checkPort, clean, fulfill, reject } from './lib/scheduler-api';
import { logger } from './logger';

const SCHEDULER_HOME = 'home';

/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog('ALL');
	
	if (ns.getHostname() !== SCHEDULER_HOME){
		throw new Error(`Scheduler only runs on ${SCHEDULER_HOME}`);
	}

	const console = logger(ns);

	const gitServer = (hostname) => ({
		hostname,
		maxRam: ns.getServerMaxRam(hostname),
		ramUsed: ns.getServerUsedRam(hostname),
	});

	const queue = [];
	while (true) {
		try {
			// ns.clearLog();
			clean(ns);
			await checkPort(ns, queue);
			if (queue.length === 0) {
				await ns.sleep(100);
				continue;
			}

			queue.sort(by(job=>job.numThreads/(1 << job.waitTime())));
			const maxJobs = Math.ceil(queue.length / 2);
			for (let i = 0; i < maxJobs && i < queue.length; i++) {
				const process = queue[i];
				if (process == null)
					await console.log(queue);
				// await systemLog(ns, process);
				if (process.waitTime() > 60000) {
					await reject(ns, queue.splice(i--, 1)[0]);
					continue;
				}
				const scriptRam = ns.getScriptRam(process.script, process.sender);
				const ramRequired = scriptRam * process.numThreads;
				if (process.hostname != null) {
					// Specific server requested
					const { maxRam, ramUsed } = gitServer(process.hostname);
					let ram = maxRam - (ramUsed||0);
					if (process.host === 'home') {
						ram -= 4; // Allow 4GB for user to run scripts
					}
					if (ramRequired <= ram) {
						// await systemLog(ns, 'APPR', process.script, process.messageFilename);
						await fulfill(ns, queue.splice(i, 1)[0], process.hostname);
						continue;
					}
				} else {
					// No preference; choose
					const availableRam = ({ hostname, maxRam, ramUsed }) => {
						if (hostname === 'home') {
							// Alow 128GB for services to start
							return Math.max(0, maxRam - ramUsed - 128);
						} else {
							return maxRam - ramUsed;
						}
					}

					const getRamData = (ns) => {
						const rootServers = nmap(ns)
							.filter(ns.hasRootAccess)
							.map(gitServer)//.filter(server=>server.hasAdminRights)
							.sort(by(availableRam));
						const purchasedServers = ns.getPurchasedServers().map(gitServer);
						const purchasedServerMaxRam = ns.getPurchasedServerMaxRam();
						const purchasedServerLimit = ns.getPurchasedServerLimit();
						const purchasedServersMaxedOut = purchasedServers.length === purchasedServerLimit &&
							purchasedServers.every(server=>server.maxRam===purchasedServerMaxRam);
						const totalMaxRam = rootServers.map(s=>s.maxRam).reduce((a,b)=>a+b,0);
						const totalRamUsed = rootServers.map(s=>s.ramUsed).reduce((a,b)=>a+b,0);
						const totalRamUnused = totalMaxRam - totalRamUsed;
						const demand = queue.map(({ script, sender, numThreads }) => numThreads * ns.getScriptRam(script, sender))
							.reduce((a,b)=>a+b, 0);
						const data = {
							rootServers,
							purchasedServers,
							purchasedServerMaxRam,
							purchasedServersMaxedOut,
							purchasedServerLimit,
							totalRamUsed,
							totalRamUnused,
							totalMaxRam,
							demand,
						};
						return data;
					}
					const ramData = getRamData(ns);
					const port = Ports(ns).getPortHandle(PORT_SCH_RAM_DATA);
					port.clear();
					port.write(ramData);

					const { rootServers, purchasedServers,
						purchasedServersMaxedOut, purchasedServerLimit } = ramData;
					const empty = Math.max(0, purchasedServers.length + 2 - purchasedServerLimit);
					const skip = purchasedServersMaxedOut ? 0 : Math.min(2, empty);
					const servers = rootServers.slice(skip);

					const server = servers.find(server => availableRam(server) >= ramRequired);
					const settleServer = servers[servers.length - 1];
					if (server != null) {
						await fulfill(ns, queue.shift(), server.hostname);
					} else if (settleServer && availableRam(settleServer) >= scriptRam) {
						await fulfill(ns, queue.shift(), settleServer.hostname);
					}
					continue;
				}
			}
			if (queue.length > 0) {
				queue.forEach(item => ns.print(item.toString()));
			}
			await ns.sleep(1);
		} catch(error) {
			await logger(ns).error(error);
			await ns.sleep(1000);
		}
	}
}
import { PORT_SCH_RAM_DATA } from './etc/ports';
import { THREADPOOL_NAME } from './etc/config';
import Ports from './lib/ports';
import { by } from './lib/util';
import { checkPort, /*clean,*/ fulfill, reject } from './lib/scheduler-api';
import { logger } from './lib/logger';
import { nmap } from './lib/nmap';
import { getStaticData } from './lib/data-store';

const SCHEDULER_HOME = 'home';

/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog('ALL');

	if (ns.getHostname() !== SCHEDULER_HOME){
		throw new Error(`Scheduler only runs on ${SCHEDULER_HOME}`);
	}

	// Scheduler completes the bootstrap process
	// by starting the planner and the logger.
	// This is done since these 3 programs can't
	// run on 8GB ram when init.js is still running.
	if (ns.args[0] === 'bootstrap') {
		await ns.sleep(50);
		ns.exec('/bin/planner.js', 'home');
		ns.exec('/bin/logger.js', 'home');
	}

	const {
		purchasedServerMaxRam,
		purchasedServerLimit,
	} = getStaticData(ns);

	const console = logger(ns);

	const getRamInfo = (hostname, isHighPriority) => {
		const maxRam = ns.getServerMaxRam(hostname);
		const ramUsed = ns.getServerUsedRam(hostname);
		const ramUnused = maxRam - ramUsed;
		const ramAvailable = (hostname === 'home' && !isHighPriority) ?
			Math.max(0, ramUnused - 8) : ramUnused;
		return {
			hostname,
			maxRam,
			ramUsed,
			ramUnused,
			ramAvailable,
		};
	};

	const getRamData = (ns) => {
		const hostnames = nmap(ns);
		const rootServers = hostnames
			.filter(ns.hasRootAccess)
			.map(getRamInfo)//.filter(server=>server.hasAdminRights)
			.sort(by(s=>-s.ramAvailable));
		const purchasedServers = hostnames
			.filter(hostname=>hostname.startsWith(THREADPOOL_NAME))
			.map(getRamInfo);
		const purchasedServersMaxedOut = purchasedServers.length === purchasedServerLimit &&
			purchasedServers.every(server=>server.maxRam===purchasedServerMaxRam);
		const totalMaxRam = rootServers.map(s=>s.maxRam).reduce((a,b)=>a+b,0) || 0;
		const totalRamUsed = rootServers.map(s=>s.ramUsed).reduce((a,b)=>a+b,0) || 0;
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
		// ns.tprint(JSON.stringify(purchasedServers, null, 2));
		return data;
	}

	const queue = [];
	while (true) {
		try {
			ns.clearLog();
			// clean(ns);
			const { length } = queue;
			await checkPort(ns, queue);
			if (queue.length === 0) {
				await ns.sleep(20);
				continue;
			} else if (queue.length !== length)
				queue.sort(by(job=>job.startTime));


			const now = Date.now();
			for (let i = 0; i < queue.length; i++) {
				const process = queue[i];
				if (process.startTime > now)
					break;
				// await systemLog(ns, process);
				if (process.waitTime() > 60000) {
					await reject(ns, queue.splice(i--, 1)[0]);
					continue;
				}
				const scriptRam = ns.getScriptRam(process.script, process.sender);
				const ramRequired = scriptRam * process.numThreads;

				const ramData = getRamData(ns);
				const port = Ports(ns).getPortHandle(PORT_SCH_RAM_DATA);
				port.clear();
				port.write(ramData);

				if (process.host != null) {
					// Specific server requested
					const server = getRamInfo(process.host, true);
					if (ramRequired <= server.ramAvailable) {
						// await systemLog(ns, 'APPR', process.script, process.messageFilename);
						await fulfill(ns, queue.splice(i, 1)[0], server);
						continue;
					}
				} else {
					// No preference; choose
					const { rootServers } = ramData;
					const eligibleServers = process.isHacking ?
						rootServers :
						rootServers.filter(server => !server.hostname.startsWith(THREADPOOL_NAME));

					const server = eligibleServers.find(server => server.ramAvailable >= ramRequired);
					const settleServer = eligibleServers[0];
					if (server != null) {
						await fulfill(ns, queue.splice(i, 1)[0], server);
					} else if (settleServer != null && settleServer.ramAvailable >= scriptRam) {
						await fulfill(ns, queue.splice(i, 1)[0], settleServer);
					}
				}
			}
			if (queue.length > 0) {
				ns.print(`${queue.length} items queued`);
				queue.slice(0, 10).forEach(item => ns.print(item.toString()));
			}
		} catch(error) {
			await logger(ns).error(error);
		} finally {
			await ns.sleep(10);
		}
	}
}
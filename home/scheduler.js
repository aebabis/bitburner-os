import { PORT_SCH_RAM_DATA } from './etc/ports';
import { THREADPOOL_NAME } from './etc/config';
import { HOSTSFILE, STATIC_DATA } from './etc/filenames';
import Ports from './lib/ports';
import { by } from './lib/util';
import { checkPort, /*clean,*/ fulfill, reject } from './lib/scheduler-api';
import { logger } from './logger';

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
	await ns.sleep(50);
	ns.exec('planner.js', 'home');
	ns.exec('logger.js', 'home');

	const {
		purchasedServerMaxRam,
		purchasedServerLimit,
	} = JSON.parse(await ns.read(STATIC_DATA));

    while (await ns.read(HOSTSFILE) === '')
        await ns.sleep(50);
    const hostnames = (await ns.read(HOSTSFILE)).split(',');

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
			await checkPort(ns, queue);
			if (queue.length === 0) {
				await ns.sleep(100);
				continue;
			}

			queue.sort(by(job=>job.numThreads/(1 << job.waitTime())));

			const maxJobsThisTick = Math.ceil(queue.length / 2);
			for (let i = 0; i < Math.min(maxJobsThisTick, queue.length); i++) {
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

				const ramData = getRamData(ns);
				const port = Ports(ns).getPortHandle(PORT_SCH_RAM_DATA);
				port.clear();
				port.write(ramData);

				if (process.host != null) {
					// Specific server requested
					const { ramAvailable } = getRamInfo(process.host, true);
					if (ramRequired <= ramAvailable) {
						// await systemLog(ns, 'APPR', process.script, process.messageFilename);
						await fulfill(ns, queue.splice(i, 1)[0], process.host);
						continue;
					}
				} else {
					// No preference; choose
					const { rootServers, purchasedServers,
						purchasedServersMaxedOut, purchasedServerLimit } = ramData;
					const empty = Math.max(0, purchasedServers.length + 2 - purchasedServerLimit);
					const skip = purchasedServersMaxedOut ? 0 : empty;
					const servers = rootServers.slice(skip);

					const server = servers.find(server => server.ramAvailable >= ramRequired);
					const settleServer = servers[0];
					if (server != null) {
						await fulfill(ns, queue.shift(), server.hostname);
					} else if (settleServer != null && settleServer.ramAvailable >= scriptRam) {
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
import { logger } from './lib/logger';
import { nmap } from './lib/nmap';
import { by } from './lib/util';
import { disableService } from './lib/planner-api.js';

const RUN_FILE = '/run/assistant.txt';

const PRIORITIES = ['CSEC', 'I.I.I.I', 'run4theh111z', 'The-Cave', 'w0r1d_d43m0n'];

/** @param {NS} ns **/
const usage = (ns) => {
	const script = ns.getScriptName();
	return `Usage:\n` +
		`  ./${script}\n` +
		`  ./${script} service\n` +
		`  ./${script} help\n`;
}

const canDirectConnect = (ns, hostname) => {
	const { isConnectedTo, backdoorInstalled } = ns.getServer(hostname);
	return hostname === 'home' || isConnectedTo || backdoorInstalled;
}

const getPathTo = (ns, hostname) => {
	if (ns.getServer(hostname).isConnectedTo)
		return [];
	const next = {};
	const visited = [hostname];
	const path = (start) => start === hostname ? [hostname] : [start, ...path(next[start])];
	for (let i = 0; i < visited.length; i++) {
		const neighbors = ns.scan(visited[i]).filter(s=>!visited.includes(s));
		for (const neighbor of neighbors) {
			visited.push(neighbor);
			next[neighbor] = visited[i];
			const { isConnectedTo, backdoorInstalled } = ns.getServer(neighbor);
			if (isConnectedTo)
				return path(visited[i]);
			else if (neighbor === 'home' || backdoorInstalled)
				return path(neighbor);
		}
	}
}

const getPath = (ns) => {
	const skill = ns.getHackingLevel();
	const servers = nmap(ns)
		.map(ns.getServer)
		.filter(server => server.hasAdminRights)
		.filter(server => !server.purchasedByPlayer)
		.filter(server => !server.backdoorInstalled)
		.filter(server => server.requiredHackingSkill <= skill);

	if (servers.length === 0)
		return null;

	const questTarget = servers.find(server => PRIORITIES.includes(server.hostname));
	
	if (questTarget != null)
		return getPathTo(ns, questTarget.hostname);
	else
		return servers.map(server => getPathTo(ns, server.hostname)).sort(by('length'))[0];
}

/** @param {NS} ns **/
const runDaemon = async (ns) => {
	const console = logger(ns);

	let previousLocation;
	let previousTarget;
	while (true) {
		const path = getPath(ns);
		ns.clearLog();
		if (path != null) {
			ns.print(path.map(s => s === 'home' ? 'home' : 'connect ' + s).join('\n') + '\nbackdoor');
			await ns.sleep(50);
		} else {
			await ns.sleep(5000);
		}
	}
}

/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog('ALL');
	const { _, tail } = ns.flags([['tail', false]]);
	if (tail)
		ns.tail();
	const [param] = _;
	if (param == null) {
		const currentTarget = await ns.read(RUN_FILE);
		ns.tprint(currentTarget);
		return;
	} else if (param === 'service') {
		await runDaemon(ns);
		return;
	} else if (param === 'help') {
		ns.tprint(usage(ns));
		return;
	} else {
		throw new Error(`Unrecognized parameter ${param}.\n${usage(ns)}`);
	}
}
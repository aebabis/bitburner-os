import { nmap } from './lib/nmap';
import { by } from './lib/util';

const PRIORITIES = ['CSEC', 'I.I.I.I', 'run4theh111z', 'The-Cave', 'w0r1d_d43m0n'];

/** @param {NS} ns **/
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
};

/** @param {NS} ns **/
export const getPath = (ns) => {
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
};
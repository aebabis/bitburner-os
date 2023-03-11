import { getHostnames } from './lib/data-store';
import { fullInfect } from './bin/infect';

/** @param {NS} ns */
export async function main(ns) {
	const hostnames = getHostnames(ns);
	const [home, n00dles] = hostnames;
	while (ns.getHackingLevel() < 5) {
		ns.exec('/bin/workers/hack.js', 'home', 2, n00dles);
		await ns.hack(n00dles);
	}
	const targets = hostnames.filter(s=>ns.getServerRequiredHackingLevel(s)<=ns.getHackingLevel());
	ns.tprint(targets);
	fullInfect(ns, ...targets);
	await ns.sleep(5000);
	ns.exec('/bin/scheduler.js', 'home');
}
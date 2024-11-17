import { getHostnames } from '/lib/data-store';
import { fullInfect } from '/bin/infect';

/** @param {NS} ns */
export async function main(ns) {
	const hostnames = getHostnames(ns);
	const [home, n00dles] = hostnames;
	while (ns.getHackingLevel() < 5) {
		const HOME_RAM = ns.getServerMaxRam('home');
		const THIS_RAM = ns.getScriptRam('/bin/eight-gig.js');
		const HACK_RAM = ns.getScriptRam('/bin/workers/hack.js');
		const threads = Math.floor((HOME_RAM-THIS_RAM)/HACK_RAM);
		ns.exec('/bin/workers/hack.js', 'home', threads, n00dles);
		await ns.hack(n00dles);
	}
	const targets = hostnames.filter(s=>ns.getServerRequiredHackingLevel(s)<=ns.getHackingLevel());
	ns.tprint(targets);
	fullInfect(ns, ...targets);
	await ns.sleep(5000);
	ns.exec('/bin/scheduler.js', 'home');
}

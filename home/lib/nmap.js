import { putHostnames } from './lib/data-store';

/** @param {NS} ns **/
export const nmap = (ns) => {
	const hostnames = ['home'];
	for (let i = 0; i < hostnames.length; i++) {
		let hostname = hostnames[i];
		ns.scan(hostname).forEach(hostname => {
			if (!hostnames.includes(hostname)) {
				hostnames.push(hostname);
			}
		});
	}
	return hostnames;
}

/** @param {NS} ns **/
export const saveHostnames = (ns) => putHostnames(ns, nmap(ns));

/** @param {NS} ns **/
export const main = saveHostnames;
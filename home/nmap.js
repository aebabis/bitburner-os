import { HOSTSFILE } from './etc/filenames';
import { write } from './lib/util';

/** @param {NS} ns **/
export const nmap = async(ns) => {
	const hostnames = ["home"];
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
export const main = async(ns) => {
	const hostnames = await nmap(ns);
	await write(ns)(HOSTSFILE, hostnames.join(','), 'w');
}
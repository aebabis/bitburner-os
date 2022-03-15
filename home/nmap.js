import { FILES } from './etc/filenames';
import { write } from './lib/util';

export const getHostnames = async(ns) => {
	while (true) {
		const hostnames = await ns.read(FILES.HOSTS);
		return hostnames.split(',');
	}
}

export const nmap = (ns) => {
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
	const hostnames = nmap(ns);
	await write(ns)(FILES.HOSTS, hostnames.join(','), 'w');
}
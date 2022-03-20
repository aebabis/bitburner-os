import { HOSTSFILE } from './etc/filenames';

/** @param {NS} ns **/
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

export const writeHostsfile = async (ns) => {
	const hostnames = nmap(ns);
	await ns.write(HOSTSFILE, hostnames.join(','), 'w');
}

/** @param {NS} ns **/
export const main = async(ns) => {
	await writeHostsfile(ns);
}
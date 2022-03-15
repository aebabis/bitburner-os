import { by } from './lib/util';
import { nmap } from './nmap';

const d1 = n=>n.toFixed(1);

const moneyFormat = (amount) => {
	if (amount < 1e3) {
		return `$${d1(amount)}`;
	} else if (amount < 1e6) {
		return `$${d1(amount / 1e3)}k`;
	} else if (amount < 1e9) {
		return `$${d1(amount / 1e6)}M`;
	} else if (amount < 1e12) {
		return `$${d1(amount / 1e9)}B`;
	} else if (amount < 1e15) {
		return `$${d1(amount / 1e12)}T`;
	} else {
		return `$${d1(amount / 1e15)}Q`;
	}
}

export const serverString = (ns, server) => {
	const {
		backdoorInstalled, hasAdminRights, hostname, ip,
		ramUsed,maxRam,
		numOpenPortsRequired, serverGrowth,
		requiredHackingSkill,baseDifficulty,hackDifficulty,minDifficulty,
		moneyAvailable, moneyMax,
	} = server;
	const GB = 1024 ** 3;
	const status = backdoorInstalled ? 'BD' : hasAdminRights ? 'A' : '';
	const ram = `RAM=${ns.nFormat(ramUsed*GB, '0b')}/${ns.nFormat(maxRam*GB, '0b')}`;
	const money = `${moneyFormat(moneyAvailable)}/${moneyFormat(moneyMax)}`;
	const ports = 'Ports=' + numOpenPortsRequired;
	const hacking = `Hack=${~~requiredHackingSkill}(${~~minDifficulty}/${~~hackDifficulty}/${~~baseDifficulty})`;
	const grow = `Grow=${serverGrowth}`;
	const name = `${hostname} (${ip}) ${status}`;
	return `${name.padEnd(32)} ${ram.padEnd(15)}  ${ports}  ${money.padEnd(15)}  ${hacking.padEnd(20)} ${grow}`;
}

/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog('ALL');
	
	while (true) {
		ns.clearLog();
		nmap(ns).map(hostname => ns.getServer(hostname))
			.sort(by('hostname'))
			.sort(by('maxRam'))
			.sort(by('requiredHackingSkill'))
			.forEach(server => ns.print(serverString(ns, server)));
		await ns.sleep(5000);
	}
}
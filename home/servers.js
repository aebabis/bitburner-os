import { by } from './lib/util';
import { nmap } from './lib/nmap';

/** @param {NS} ns **/
const getServers = (ns) => nmap(ns)
	.filter(name => name !== 'home' && !name.startsWith('THREADPOOL'))
	.map(ns.getServer)
	.sort(by('hostname'))
	.sort(by('maxRam'))
	.sort(by('requiredHackingSkill'));

const serverString = (ns, server) => {
	const {
		backdoorInstalled, hasAdminRights, hostname, ip,
		// organizationName,contracts,purchasedByPlayer,
		cpuCores,ramUsed,maxRam,
		// sshPortOpen,ftpPortOpen,smtpPortOpen,httpPortOpen,sqlPortOpen,
		numOpenPortsRequired, serverGrowth, //openPortCount,
		// messages, textFiles,programs,scripts,
		// runningScripts, serversOnNetwork, isConnectedTo,
		requiredHackingSkill,baseDifficulty,hackDifficulty,minDifficulty,
		moneyAvailable, moneyMax,
	} = server;
	// const bit = (open) => open ? '1' : '0';
	const GB = 1024 ** 3;
	const status = backdoorInstalled ? 'BD' : hasAdminRights ? 'A' : '';
	const ram = `RAM=${ns.nFormat(ramUsed*GB, '0b')}/${ns.nFormat(maxRam*GB, '0b')}`;
	// const cores = `Cores=${cpuCores}`;
	const money = `${ns.nFormat(moneyAvailable, '0.00a')}/${ns.nFormat(moneyMax, '0.00a')}`;
	const ports = 'Ports=' + numOpenPortsRequired;
	const hacking = `Hack=${~~requiredHackingSkill}(${~~minDifficulty}/${~~hackDifficulty}/${~~baseDifficulty})`;
	const gr0w = `Grow=${serverGrowth}`;
	const name = `${hostname} (${ip}) ${status}`;
	return `${name.padEnd(32)} ${ram.padEnd(15)}  ${ports}  ${money.padEnd(15)}  ${hacking.padEnd(20)} ${gr0w}`;
}

/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog('ALL');
	
	const [command] = ns.args;

	if (command == null) {
			getServers(ns).forEach(server => ns.tprint(serverString(ns, server)));
	} else {
		if (command === 'service') {
			while (true) {
				ns.clearLog();
				getServers(ns).forEach(server => ns.print(serverString(ns, server)));
				await ns.sleep(5000);
			}
		} else {
			throw new Error('Illegal argument: ' + command); // TODO: Usage
		}
	}
}
import { by } from './lib/util';
import { nmap } from './nmap';

/** @param {NS} ns **/
const getServers = (ns) => nmap(ns)
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
	const grow = `Grow=${serverGrowth}`;
	const name = `${hostname} (${ip}) ${status}`;
	return `${name.padEnd(32)} ${ram.padEnd(15)}  ${ports}  ${money.padEnd(15)}  ${hacking.padEnd(20)} ${grow}`;
}

/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog('ALL');
	
	const [command, p1] = ns.args;
	switch (command) {
		case ('purchased'):
			return getServers(ns, server=>server.purchasedByPlayer).forEach(server => ns.tprint(serverString(ns, server)));
		case ('kill'):
			ns.killall(p1);
			return ns.deleteServer(p1);
		case(undefined):
			while (true) {
				ns.clearLog();
				getServers(ns).forEach(server => ns.print(serverString(ns, server)));
				await ns.sleep(5000);
			}
	}
}
import { by, small } from './lib/util';
import { nmap } from './lib/nmap';
import { table } from './lib/table';
import { THREADPOOL } from './etc/config';

/** @param {NS} ns **/
const getServers = (ns) => nmap(ns)
	.filter(name => name !== 'home' && !name.startsWith(THREADPOOL))
	.map(ns.getServer)
	.sort(by('hostname'))
	.sort(by('maxRam'))
	.sort(by('requiredHackingSkill'));

/** @param {NS} ns **/
const serverRow = (ns, server) => {
	const {
		backdoorInstalled, hasAdminRights, hostname,
		ramUsed,maxRam,
		numOpenPortsRequired,
		requiredHackingSkill,hackDifficulty,minDifficulty,
		moneyAvailable, moneyMax,
	} = server;

	const GB = 1e9;

	const status = backdoorInstalled ? '💻 ' : hasAdminRights ? '🔗 ' : '❌\u200b ';
	const name = `${status}${hostname}${small(numOpenPortsRequired)}`;
	const money = `${ns.nFormat(moneyAvailable, '0.00a')}/${ns.nFormat(moneyMax, '0.00a')}`;
	const ram = `${ns.nFormat(ramUsed*GB, '0b')}/${ns.nFormat(maxRam*GB, '0b')}`;
	const level = requiredHackingSkill;
	const hacking = `${~~minDifficulty}/${~~hackDifficulty}`;
	return {
		name,
		money,
		ram,
		level,
		hacking,
	};
};

/** @param {NS} ns **/
const getTable = (ns) => {
	const columns = ['\u2796\u200b HOSTNAME'+small('ports'), 'MONEY', 'RAM', 'LEVEL', 'HACKING'];
	const data = getServers(ns).map(server => serverRow(ns, server))
		.map(({name, money, ram, level, hacking}) => [name, money, ram, level, hacking]);
	const mid = Math.ceil(data.length / 2);
	const left = data.slice(0, mid);
	const right = data.slice(mid);
	const doubled = left.map((row, i) => [...row, ...(right[i]||[])]);

	return table(ns, [...columns, ...columns], doubled);
};

/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog('ALL');
	
	const [command] = ns.args;

	if (command == null) {
		ns.tprint('\n' + getTable(ns));
	} else {
		if (command === 'service') {
			while (true) {
				ns.clearLog();
				ns.print(getTable(ns));
				await ns.sleep(5000);
			}
		} else {
			throw new Error('Illegal argument: ' + command); // TODO: Usage
		}
	}
}
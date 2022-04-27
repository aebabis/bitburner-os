import { disableService } from './lib/planner-api.js';
import { getPath } from './lib/backdoor.js';
import { putDashboardData } from './lib/data-store.js';

const RUN_FILE = '/run/assistant.txt';

/** @param {NS} ns **/
const usage = (ns) => {
	const script = ns.getScriptName();
	return `Usage:\n` +
		`  ./${script}\n` +
		`  ./${script} service\n` +
		`  ./${script} help\n`;
}

/** @param {NS} ns **/
const runDaemon = async (ns) => {
	while (true) {
		const path = getPath(ns);
		ns.clearLog();
		if (path != null) {
			const backdoor = path.map(s => s === 'home' ? 'home' : 'connect ' + s).join('\n') + '\nbackdoor';
			putDashboardData(ns, { backdoor });
			ns.print(backdoor);
			await ns.sleep(50);
		} else {
			await ns.sleep(5000);
		}
	}
}

/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog('ALL');
	const { _, tail } = ns.flags([['tail', false]]);
	if (tail)
		ns.tail();
	const [param] = _;
	if (param == null) {
		const currentTarget = await ns.read(RUN_FILE);
		ns.tprint(currentTarget);
		return;
	} else if (param === 'service') {
		await runDaemon(ns);
		return;
	} else if (param === 'help') {
		ns.tprint(usage(ns));
		return;
	} else {
		throw new Error(`Unrecognized parameter ${param}.\n${usage(ns)}`);
	}
}
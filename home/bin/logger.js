import { PORT_LOGGER } from './etc/ports.js';

const MAX_HISTORY = 100;
const LOGGER_HOME = 'home';

const history = [];

/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog('ALL');
	if (ns.getHostname() !== LOGGER_HOME){
		throw new Error('Logger only runs on the home server');
	}
	ns.tail();
	while (true) {
		try {
			const port = ns.getPortHandle(PORT_LOGGER);
			let changed = false;
			while (!port.empty()) {
				changed = true;
				history.push(port.read());
				while (history.length > MAX_HISTORY)
					history.shift();
			}
			if (changed) {
				ns.clearLog();
				history.forEach(m=>ns.print(m));
			}
		} catch(error) {
			ns.print('ERROR ' + error.name + ' ' + error.message + ' ' + error.lineNumber + ':' + error.columnNumber); // TODO: Pretty
		} finally {
			await ns.sleep(10);
		}
	}
}
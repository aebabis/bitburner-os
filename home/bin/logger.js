import { PORT_LOGGER, PORT_REPORTER } from './etc/ports.js';
import Ports from './lib/ports';

const MAX_HISTORY = 100;
const LOGGER_HOME = 'home';

const history = [];

/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog('ALL');
	if (ns.getHostname() !== LOGGER_HOME){
		throw new Error('Logger only runs on the home server');
	}
	while (true) {
		try {
			const logPort = Ports(ns).getPortHandle(PORT_LOGGER);
			const rePort = Ports(ns).getPortHandle(PORT_REPORTER);
			let changed = false;
			while (!logPort.empty()) {
				changed = true;
				history.push(logPort.read());
				while (history.length > MAX_HISTORY)
					history.shift();
			}
			if (changed) {
				ns.clearLog();
				history.forEach(m=>ns.print(m));
			}

			while (!rePort.empty()) {
				const { filename, content, mode } = rePort.read();
				await ns.write(filename, content, mode);
			}
		} catch(error) {
			ns.print('ERROR ' + error.name + ' ' + error.message + ' ' + error.lineNumber + ':' + error.columnNumber); // TODO: Pretty
		} finally {
			await ns.sleep(10);
		}
	}
}
import { PORT_LOGGER } from './etc/ports.js';

const MAX_HISTORY = 100;
const LOGGER_HOME = 'home';

const history = [];

const process = (arg) => {
	if (arg instanceof Error) {
		return arg.name + ' ' + arg.message + ' ' + arg.lineNumber + ':' + arg.columnNumber + '\n' + arg.stack;
	} else if (typeof arg === 'object')
		return JSON.stringify(arg, null, 2);
	return arg;
}

/** @param {NS} ns **/
export const logger = (ns, options = {}) => {
	const { echo = true } = options;
	const send = async (type, ...args) => {
		const script = ns.getScriptName();
		const lead = `${type} ${script}`;
		const message = args.map(process).join(' ');
		const output =  `${lead.padEnd(20)} ${message}`;
		if (echo) {
			ns.print(output);
		}
		let time = Date.now();
		while (!ns.getPortHandle(PORT_LOGGER).tryWrite(output)) {
			if (Date.now() - time > 1000) {
				ns.tprint('ERROR - Log stream blocked. Do you need to start the logger?');
				return;
			}
			await ns.sleep(10);
		}
	}
	return {
		log:   async (...args) => await send('SUCCESS', ...args),
		error: async (...args) => await send('ERROR', ...args),
		info:  async (...args) => await send('INFO', ...args),
		warn:  async (...args) => await send('WARN', ...args),
	}
}

export const logger_inline = logger.toString().replace('PORT_LOGGER', PORT_LOGGER);

/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog('ALL');
	if (ns.args[0] != null) {
		switch(ns.args[0]) {
			case 'tail':
				// TODO
				return;
			case 'recent':
				// TODO
				return;
			default:
				throw new Error(`Unrecognized command: ${ns.args[0]}`);
		}
	} else if (ns.getHostname() !== LOGGER_HOME){
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
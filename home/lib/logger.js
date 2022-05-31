import { PORT_LOGGER, PORT_REPORTER } from './etc/ports.js';
import Ports from './lib/ports';

const process = (arg) => {
	if (arg instanceof Error) {
		return arg.name + ' ' + arg.message + ' ' + arg.lineNumber + ':' + arg.columnNumber + '\n' + arg.stack;
	} else if (typeof arg === 'object')
		return JSON.stringify(arg, null, 2);
	return arg;
};

/** @param {NS} ns **/
export const logger = (ns, options = {}) => {
	const { echo = true } = options;
	const port = Ports(ns).getPortHandle(PORT_LOGGER);
	const send = async (type, ...args) => {
		const script = ns.getScriptName();
		const lead = `${type} ${script}`;
		const message = args.map(process).join(' ');
		const output =  `${lead.padEnd(20)} ${message}`;
		if (type === 'ERROR')
			ns.tprint(output);
		else if (echo) {
			ns.print(output);
		}
		let time = Date.now();
		while (!port.tryWrite(output)) {
			if (Date.now() - time > 1000) {
				ns.tprint('ERROR - Log stream blocked. Do you need to start the logger?');
				return;
			}
			await ns.sleep(10);
		}
	};
	return {
		log:   async (...args) => await send('SUCCESS', ...args),
		error: async (...args) => await send('ERROR', ...args),
		info:  async (...args) => await send('INFO', ...args),
		warn:  async (...args) => await send('WARN', ...args),
	};
};

/** @param {NS} ns **/
export const report = (ns, filename, content, mode) => {
	const port = Ports(ns).getPortHandle(PORT_REPORTER);
    port.blockingWrite({ filename, content, mode });
};

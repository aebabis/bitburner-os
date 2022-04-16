import { PORT_LOGGER } from './etc/ports.js';

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

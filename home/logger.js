import { PORTS } from './etc/ports.js';

const LOGGER_HOME = 'home';

const pad8 = (input) => {
	const str = input.toString();
	return str + ' '.repeat(str.length % 8);
}

/** @param {NS} ns **/
const log = async (ns, script, ...args) => {
	const output = script.padEnd(20) + ' ' + args.map(pad8).join(' ') + '\n';
	ns.print(script + ' ' + output);
}

const process = (arg) => {
	if (arg instanceof Error) {
		return 'ERROR ' + error.name + ' ' + error.message + ' ' + error.lineNumber + ':' + error.columnNumber;
	}
	return arg;
}

/** @param {NS} ns **/
export const logger = (ns) => async (...args) => {
	args = args.map(process);
	const script = ns.getScriptName();
	const message = { script, args };
	while (!ns.getPortHandle(PORTS.LOGGER).tryWrite(JSON.stringify(message)))
		await ns.sleep(10);
}

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
	} else if (ns.getServer().hostname !== LOGGER_HOME){
		throw new Error('Logger only runs on the home server');
	}
	while (true) {
		try {
			const port = ns.getPortHandle(PORTS.LOGGER);
			while (!port.empty()) {
				const message = port.read();
				const { script, args } = JSON.parse(message);
				log(ns, script, args);
			}
		} catch(error) {
			ns.print('ERROR ' + error.name + ' ' + error.message + ' ' + error.lineNumber + ':' + error.columnNumber); // TODO: Pretty
		} finally {
			await ns.sleep(10);
		}
	}
}
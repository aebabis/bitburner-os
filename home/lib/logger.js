import { LOG, ERROR, INFO, WARN } from './lib/colors';

const DEBUG = true;

const processArg = (arg) => {
	if (arg instanceof Error) {
		return arg.name + ' ' + arg.message + ' ' + arg.lineNumber + ':' + arg.columnNumber + '\n' + arg.stack;
	} else if (typeof arg === 'object')
		return JSON.stringify(arg, null, 2);
	return arg;
}

const process = (args) => args.map(processArg).join(' ');

/** @param {NS} ns **/
export const logger = (ns, options = {}) => {
	const { debug=DEBUG } = options;

	const name = ns.getScriptName();
	const pad  = Math.max(0, 20 - name.length);
	const lead = ' '.repeat(pad);

	const print = (TYPE, args) => {
		const text = process(args);
		ns.print(TYPE + text);
		if (debug || TYPE === ERROR)
			ns.tprint(TYPE + lead + text);
	}

	return {
		log:   async (...args) => print(LOG, args),
		error: async (...args) => print(ERROR, args),
		info:  async (...args) => print(INFO, args),
		warn:  async (...args) => print(WARN, args),
	};
};

/** @param {NS} ns **/
export async function main(ns) {
	const console = logger(ns, {debug:true});
	console.log('This is a test of the logger.log function');
	console.error('If it was a real log it would probably be the error color');
	console.info('This has a been a test of the logger functionality');
	console.warn('You may now resume your previous activity');
}
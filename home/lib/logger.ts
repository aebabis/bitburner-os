import { LOG, ERROR, INFO, WARN } from './colors';

const DEBUG = false;

const processArg = (arg) => {
  if (arg instanceof Error) {
    const e =
      /** @type {Error & {lineNumber?: number, columnNumber?: number}} */ arg;
    return (
      e.name +
      ' ' +
      e.message +
      ' ' +
      e.lineNumber +
      ':' +
      e.columnNumber +
      '\n' +
      e.stack
    );
  } else if (typeof arg === 'object') return JSON.stringify(arg, null, 2);
  return arg;
};

const process = (args) => args.map(processArg).join(' ');

/** @param {NS} ns **/
export const logger = (ns, /** @type {{debug?: boolean}} */ options = {}) => {
  const { debug = DEBUG } = options;

  const name = ns.getScriptName();
  const pad = Math.max(0, 20 - name.length);
  const lead = ' '.repeat(pad);

  const print = (/** @type {string} */ TYPE, args) => {
    const text = process(args);
    ns.print(TYPE + text);
    if (debug) ns.tprint(TYPE + lead + text);
  };

  return {
    log: async (...args) => print(LOG, args),
    error: async (...args) => print(ERROR, args),
    info: async (...args) => print(INFO, args),
    warn: async (...args) => print(WARN, args),
  };
};

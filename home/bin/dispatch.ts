import { delegateAny } from '../lib/scheduler-delegate';

export async function main(ns: NS) {
  const [script, ...args] = ns.args;
  if (typeof script !== 'string')
    throw new Error('Paramter must be a script name. Got: ' + script);
  delegateAny(ns)(/** @type {string} */ script, 1, ...args);
}

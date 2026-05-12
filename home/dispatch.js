import { delegateAny } from './lib/scheduler-delegate';

/** @param {NS} ns **/
export async function main(ns) {
  const [script, ...args] = ns.args;
  delegateAny(ns)(/** @type {string} */ (script), 1, ...args);
}

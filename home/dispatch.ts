import { delegateAny } from './lib/scheduler-delegate';

export async function main(ns: NS) {
  const [script, ...args] = ns.args;
  delegateAny(ns)(/** @type {string} */ script, 1, ...args);
}

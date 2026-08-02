import { delegateAny } from '../lib/scheduler-delegate';

export async function main(ns: NS) {
  const [script, ...args] = ns.args;
  if (typeof script !== 'string') throw new Error('Paramter must be a script name. Got: ' + script);
  await delegateAny(ns)(script, 1, ...args);
}

import { table, transpose } from './lib/table';

export async function main(ns: NS) {
  const COLS = 4;

  const lines = ns
    .ls('home')
    .filter((file) => file.endsWith('.ts'))
    .map((script) => [script, ns.getScriptRam(script) + 'GB']);

  ns.tprint('\n' + table(ns, null, transpose(lines, COLS)));
}

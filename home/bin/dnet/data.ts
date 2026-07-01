import { BRIGHT } from '../../lib/colors';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.ui.openTail();
  ns.ui.resizeTail(800, 600);

  const data = ns.peek(12289108104000) as Record<string, Record<string, string>>;
  const tmpNode = globalThis['document'].createElement('div');

  for (const [hostname, files] of Object.entries(data)) {
    if (Object.keys(files).length === 0) continue;
    ns.print(BRIGHT.BOLD + hostname);
    for (const [filename, content] of Object.entries(files)) {
      tmpNode.innerHTML = content;
      ns.print('  ' + filename.padEnd(30), tmpNode.innerText);
    }
  }
}

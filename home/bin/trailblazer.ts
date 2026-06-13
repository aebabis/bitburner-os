import { getPath } from '../lib/backdoor.ts';
import { BRIGHT } from '../lib/colors';

const sendCommand = async (command: string) => {
  const input = globalThis['document'].querySelector('input');

  if (!input) {
    throw new Error('input not found');
  }
  input.focus();

  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    globalThis.HTMLInputElement.prototype,
    'value',
  )!.set;
  nativeInputValueSetter!.call(input, command);
  const event = new Event('input', { bubbles: true });
  input.dispatchEvent(event);

  input.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true, // Crucial: React listens at the root/parent level
      cancelable: true,
    }),
  );
};

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.ui.openTail();
  ns.ui.resizeTail(300, 300);

  while (true) {
    ns.clearLog();
    ns.print(` ${BRIGHT.BOLD('BACKDOOR HELPER')} \n`);
    const path = getPath(ns);
    if (path == null) {
      ns.print(' (no available servers) ');
    } else {
      const rows = [
        ...path.map((s: string) => (s === 'home' ? ' home' : ` connect ${s} `)),
        ' backdoor',
      ];
      // await sendCommand(rows.join(';'));
      while (rows.length < 15) {
        rows.push('');
      }
      ns.print(rows.join('\n'));
    }
    await ns.sleep(100);
  }
}

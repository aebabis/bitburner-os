import { C } from '../lib/colors';
import { getStaticData } from '../lib/data-store';
import { table } from '../lib/table';

const SHARE_GB = 4;

export async function main(ns: NS) {
  const { purchasedServerLimit, purchasedServerMaxRam } = getStaticData(ns);
  let threads = 1;
  const rows: [string, string, string, string][] = [
    ['THREADS', 'RAM', 'SHARE POWER', 'SHARE/PB'],
  ];
  const shareStr = (threads: number, sharePower: number) => {
    const share = ((sharePower - 1) * 2 ** 20) / (threads * SHARE_GB);
    return ns.format.number(share);
  };
  while (threads * SHARE_GB < purchasedServerMaxRam) {
    const sharePower = ns.formulas.reputation.sharePower(threads);
    rows.push([
      `${threads}`,
      `${threads * 4}`,
      ns.format.number(sharePower),
      shareStr(threads, sharePower),
    ]);
    threads *= 2;
  }
  threads = Math.floor(purchasedServerMaxRam / SHARE_GB);
  const sharePower = ns.formulas.reputation.sharePower(threads);
  rows.push([
    C(10)(`${threads}`),
    C(10)(`${threads * 4}`),
    C(10)(ns.format.number(sharePower)),
    C(10)(shareStr(threads, sharePower)),
  ]);
  for (let n = 2; n <= purchasedServerLimit; n++) {
    threads = Math.floor((n * purchasedServerMaxRam) / SHARE_GB);
    const sharePower = ns.formulas.reputation.sharePower(threads);
    rows.push([
      `${threads}`,
      `${threads * 4}`,
      ns.format.number(sharePower),
      shareStr(threads, sharePower),
    ]);
  }

  ns.tprint('\n\n' + table(ns, null, rows, { colors: true }) + '\n\n');
}

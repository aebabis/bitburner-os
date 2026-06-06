export const packThreads = (intRam: number, intSize: 34 | 35) => {
  const intOther = 34 + 35 - intSize;
  const M = Math.floor(intRam / intSize);
  const r =
    intSize === 34
      ? ((-intRam % intOther) + intOther) % intOther
      : intRam % intOther;
  const threads = r + intOther * Math.floor((M - r) / intOther);
  if (threads < 0) {
    return Math.floor(intRam / intSize);
  } else {
    return threads;
  }
};

const test = (ns: NS, ram: number, type: 'HACK' | 'WEAKEN' | 'GROW') => {
  if (type === 'HACK') {
    const h = packThreads(ram * 20, 34);
    const w = (ram - h * 1.7) / 1.75;
    ns.tprint(`${h} * 1.75 + ${w} * 1.7 = ${h * 1.7 + w * 1.75}`);
  } else {
    const w = packThreads(ram * 20, 35);
    const h = (ram - w * 1.75) / 1.7;
    ns.tprint(`${h} * 1.75 + ${w} * 1.7 = ${h * 1.7 + w * 1.75}`);
  }
};

export async function main(ns: NS) {
  test(ns, 1000, 'HACK');
  test(ns, 1000, 'WEAKEN');
  test(ns, ns.cloud.getRamLimit(), 'HACK');
  test(ns, ns.cloud.getRamLimit(), 'WEAKEN');
}

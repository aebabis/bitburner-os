/** @param {NS} ns */
export async function main(ns) {
  const MIN = 5;
  const MAX = 10;
  const count = MIN + ~~(Math.random() * (MAX-MIN));
  // Have share automatically die in-case
  // master process is RAM-starved
  for (let c = 0; c < count; c++) {
    await ns.share();
  }
}

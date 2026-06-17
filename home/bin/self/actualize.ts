const BN_SEQUENCE: [number, number][] = [
  [1, 1],
  [4, 1],
  [4, 2],
  [1, 2],
  [4, 3],

  [5, 1],
  [2, 1],
  [3, 1],

  [1, 3],

  [6, 1],
  [6, 2],
  [6, 3],

  [7, 1],
  [7, 2],
  [7, 3],
];

export async function main(ns: NS) {
  const { ownedSF } = ns.getResetInfo();
  const [nextBN] = BN_SEQUENCE.find(([bn, level]) => (ownedSF.get(bn) ?? 0) < level) ?? [12];
  ns.singularity.destroyW0r1dD43m0n(nextBN, 'start.ts');
}

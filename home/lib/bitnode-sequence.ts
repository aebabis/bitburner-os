const BN_SEQUENCE: [number, number][] = [
  [1, 1],
  [4, 2],
  [1, 2],
  [4, 3],

  [5, 1],
  [2, 1],
  [1, 3],

  [3, 1],

  [12, 5],

  [6, 1],
  [6, 2],
  [6, 3],

  [7, 1],
  [7, 2],
  [12, 8],
];

export const getNextBitnode = (resetInfo: ResetInfo) => {
  const { ownedSF } = resetInfo;
  const nextUnmet = BN_SEQUENCE.find(([bn, level]) => (ownedSF.get(bn) ?? 0) < level);
  return nextUnmet?.[0] ?? 12;
};

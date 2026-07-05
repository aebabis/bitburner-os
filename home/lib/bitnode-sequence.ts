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

  [15, 1],

  [6, 2],
  [6, 3],

  [7, 1],

  [7, 2],
  [12, 8],

  [15, 2],

  [3, 3],
  [12, 12],

  [5, 3],

  [15, 3],
  // [9, 1],
];

export const getNextBitnode = (resetInfo: ResetInfo): [number, number] => {
  const { currentNode, ownedSF } = resetInfo;
  const getLevel = (bn: number) => ownedSF.get(bn) ?? 0;
  const nextUnmet = BN_SEQUENCE.find(([bn, level]) => {
    let sfLevel = getLevel(bn);
    const levelAfterInstall = bn === currentNode ? sfLevel + 1 : sfLevel;
    return levelAfterInstall < level;
  });
  const nextBN = nextUnmet?.[0] ?? 12;
  const nextLevel = currentNode === nextBN ? getLevel(nextBN) + 2 : getLevel(nextBN) + 1;
  return [nextBN, nextLevel];
};

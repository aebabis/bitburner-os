export const getAverageClashWinChance = (
  gangName: string,
  allGangInfo: Record<string, GangOtherInfoObject>,
) => {
  const { power } = allGangInfo[gangName as string];
  const otherGangInfo = Object.entries(allGangInfo)
    .filter(([faction]) => faction !== gangName)
    .map(([, info]) => info);
  return (
    otherGangInfo.map((info) => power / (power + info.power)).reduce((a, b) => a + b, 0) /
    otherGangInfo.length
  );
};

export const needsPower = (gangName: string, allGangInfo: Record<string, GangOtherInfoObject>) => {
  const { power } = allGangInfo[gangName as string];
  const otherGangInfo = Object.entries(allGangInfo)
    .filter(([faction]) => faction !== gangName)
    .map(([, info]) => info);
  return otherGangInfo.map((info) => power / (power + info.power)).some((chance) => chance < 0.9);
};

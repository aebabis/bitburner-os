export const getFightWinRates = (
  gangName: string,
  allGangInfo: Record<string, GangOtherInfoObject>,
) => {
  const { power } = allGangInfo[gangName as string];
  const otherGangInfo = Object.entries(allGangInfo)
    .filter(([faction]) => faction !== gangName)
    .map(([, info]) => info);
  return otherGangInfo.map((info) => power / (power + info.power));
};

export const needsPower = (gangName: string, allGangInfo: Record<string, GangOtherInfoObject>) => {
  const { power } = allGangInfo[gangName as string];
  const otherGangInfo = Object.entries(allGangInfo)
    .filter(([faction]) => faction !== gangName)
    .map(([, info]) => info);
  return otherGangInfo.map((info) => power / (power + info.power)).some((chance) => chance < 0.9);
};

import { getMoneyData, StaticData } from './data-store';

export const hasBitNode = (bn: number, staticData: StaticData) => {
  const { resetInfo } = staticData;
  return resetInfo.currentNode === bn || resetInfo.ownedSF.has(bn);
};

export const getIncome = (ns: NS) => {
  const {
    hacknetIncome = 0,
    gangIncome = 0,
    stockIncome = 0,
    theftIncome = 0,
    theftRatePerGB = 0,
    dividendEarnings = 0,
    darknetIncome = 0,
  } = getMoneyData(ns);
  const totalIncome =
    hacknetIncome + gangIncome + stockIncome + theftIncome + dividendEarnings + darknetIncome;
  return {
    hacknetIncome,
    gangIncome,
    stockIncome,
    theftIncome,
    dividendEarnings,
    darknetIncome,
    totalIncome,
    theftRatePerGB,
  };
};

export const gangsAllowed = (staticData: StaticData) => {
  const { currentNode, bitNodeOptions } = staticData.resetInfo;
  return hasBitNode(2, staticData) && !bitNodeOptions.disableGang && currentNode !== 8;
};

export const usingCorp = (staticData: StaticData) => {
  const { resetInfo } = staticData;
  if (resetInfo.currentNode === 8 || resetInfo.bitNodeOptions.disableCorporation) return false;
  return [3, 10, 12].includes(resetInfo.currentNode);
};

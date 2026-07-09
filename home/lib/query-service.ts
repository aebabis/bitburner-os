import { getStaticData, getMoneyData } from './data-store';

export const hasBitNode = (ns: NS, bn: number) => {
  const { resetInfo } = getStaticData(ns);
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

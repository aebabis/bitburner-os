const HACKNET_MONEY = [
  null,
  1,
  1,
  0.25,
  0.05,
  0.2,
  0.2,
  0.2,
  0,
  1,
  0.5,
  0.1,
  1 / 1.02,
];

export const getBitNodeMultipliers = (currentNode) => {
  return {
    HacknetNodeMoney: HACKNET_MONEY[currentNode],
  };
};

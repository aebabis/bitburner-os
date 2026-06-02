import { twoColor } from './algorithms';

export const main = async (ns: NS) => {
  // ns.codingcontract.createDummyContract('Proper 2-Coloring of a Graph', 'home');
  const problem = [
    13,
    [
      [0, 2],
      [0, 9],
      [0, 6],
      [1, 10],
      [1, 9],
      [1, 6],
      [1, 3],
      [2, 8],
      [4, 7],
      [4, 5],
      [4, 12],
      [5, 11],
      [5, 6],
      [6, 7],
      [6, 12],
      [6, 8],
      [8, 9],
      [8, 10],
      [9, 12],
      [10, 12],
      [11, 12],
    ],
  ] as [number, number[][]];
  const result = twoColor(problem);
  ns.tprint(result);
};

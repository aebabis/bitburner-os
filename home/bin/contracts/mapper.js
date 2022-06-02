import {
    countPaths,
    generateIPs,
    maximumSubarraySum,
    fewestHops,
    mergeIntervals,
    fixParensOpt,
    spiralizeMatrix,
    computeSumPermutations,
    lpf,
    pathToCorner,
    hammingCorrect,
    stockProfit,
} from './bin/contracts/algorithms';

const arr2d = (rows, cols) => Array(rows).fill(0).map(()=> Array(cols).fill(0));

const map = {
    'Algorithmic Stock Trader I':  (prices) => stockProfit(prices, 1),
    'Algorithmic Stock Trader II': (prices) => stockProfit(prices, Infinity),
    'Algorithmic Stock Trader III':(prices) => stockProfit(prices, 2),
    'Algorithmic Stock Trader IV': ([n,p])  => stockProfit(p, n),
    'Array Jumping Game':            (track)=> +!!fewestHops(track),
    'Array Jumping Game II':                   fewestHops,
    'Find Largest Prime Factor':               lpf,
    'Generate IP Addresses':                   generateIPs,
    'HammingCodes: Encoded Binary to Integer': hammingCorrect,
    'Merge Overlapping Intervals':             mergeIntervals,
    'Sanitize Parentheses in Expression':      fixParensOpt,
    'Shortest Path in a Grid':                 pathToCorner,
    'Spiralize Matrix':                        spiralizeMatrix,
    'Subarray with Maximum Sum':               maximumSubarraySum,
    'Total Ways to Sum':                       computeSumPermutations,
    'Unique Paths in a Grid I':      ([r,c])=> countPaths(arr2d(r,c)),
    'Unique Paths in a Grid II':               countPaths,
};

export default (contractType) => map[contractType];

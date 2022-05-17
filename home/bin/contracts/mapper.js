import { countPaths, generateIPs, maximumSubarraySum, fewestHops } from './bin/contracts/algorithms';

const arr2d = (rows, cols) => Array(rows).fill(0).map(()=> Array(cols).fill(0));

const map = {
    'Unique Paths in a Grid I':  ([rows, columns]) => countPaths(arr2d(rows, columns)),
    'Unique Paths in a Grid II': countPaths,
    'Generate IP Addresses':     generateIPs,
    'Subarray with Maximum Sum': maximumSubarraySum,
    'Array Jumping Game II':     fewestHops,
};

export default (contractType) => map[contractType];

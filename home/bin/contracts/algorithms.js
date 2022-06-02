export const computeSumPermutations = (MAX) => {
  const arr = () => new Array(MAX+1).fill(1);
  const table = arr().map(arr);
  
  for (let sum = 2; sum <= MAX; sum++) {
    table[sum][1] = 1;
    for (let max = 2; max <= sum; max++) {
      table[sum][max] = table[sum][max-1] + table[sum-max][Math.min(max,sum-max)];
    }
  }

  // Subtract 1 since exactly one
  // permutation (the number by itself)
  // is invalid.
  return table[MAX][MAX] - 1;
};

export const countPaths = (grid) => {
  const h = grid.length;
  const w = grid[0].length;
  grid[h-1][w-1] = 1;
  for (let i = h - 2; i >= 0; i--) {
    if (grid[i][w-1] === 1)
      grid[i][w-1] = 0;
    else
      grid[i][w-1] = grid[i+1][w-1];
  }
  for (let i = w - 2; i >= 0; i--) {
    if (grid[h-1][i] === 1)
      grid[h-1][i] = 0;
    else
      grid[h-1][i] = grid[h-1][i+1];
  }
  for (let y = grid.length-2; y >= 0; y--) {
    const row = grid[y];
    for (let x = row.length-2; x >= 0; x--) {
      if (grid[y][x] === 1)
        grid[y][x] = 0;
      else
        grid[y][x] = grid[y][x+1] + grid[y+1][x];
    }
  }
  return grid[0][0];
};

export const generateIPs = (() => {
  const isValid = (seq) => {
    const badZero = seq[0] === '0' && seq.length > 1;
    return seq.length > 0 && !badZero && +seq <= 255;
  };

  function* getIPs(input, sections=4) {
    if (sections === 1) {
      if(isValid(input))
        yield input;
      return;
    }
    const max = Math.min(3, input.length);
    for (let dig = 1; dig <= max; dig++) {
      const first = input.substring(0, dig);
      const rest = input.substring(dig);
      if (isValid(first) && rest.length > 0)
        for (const subsequence of getIPs(rest, sections-1))
          yield `${first}.${subsequence}`;
    }
  }
  
  return (numerals) => [...getIPs(numerals)];
})();

export const maximumSubarraySum = (arr) => {
  let cur = -Infinity;
  let sum = -Infinity;
  for (const num of arr) {
    cur = Math.max(num, cur+num);
    sum = Math.max(cur, sum);
  }
  return sum;
};

export const fewestHops = (track) => {
  track[track.length-1] = 0;
  for (let i = track.length - 2; i >= 0; i--)
    track[i] = 1 + Math.min(Infinity, ...track.slice(i+1, i+1+track[i]));
  return ~~track[0];
};

export const mergeIntervals = (intervals) => {
  const result = [intervals.shift()];
  for (let [left, right] of intervals) {
    let i = 0;
    while (i < result.length) {
      const [l2, r2] = result[i];
      if (!(left > r2 || right < l2)) {
        left = Math.min(left, l2);
        right = Math.max(right, r2);
        result.splice(i, 1);
      } else {
        i++;
      }
    }
    result.push([left, right]);
  }
  return result.sort(([a],[b])=>a-b);
};

const fixParens = (str, index=0, balance=0) => {
  if (balance < 0)
    return [];
  if (index === str.length)
    return balance === 0 ? [''] : [];

  const ch = str[index];
  if (ch === '(') {
    return [
      ...fixParens(str, index+1, balance),
      ...fixParens(str, index+1, balance+1).map(s=>ch+s),
    ];
  } else if (ch === ')') {
    return [
      ...fixParens(str, index+1, balance),
      ...fixParens(str, index+1, balance-1).map(s=>ch+s),
    ];
  } else {
    return fixParens(str, index+1, balance).map(s=>ch+s);
  }
};

export const fixParensOpt = (str) => {
  const solns = fixParens(str);
  let bestLen = 0;
  let map = {};
  for (const soln of solns) {
    if (soln.length > bestLen) {
      bestLen = soln.length;
      map = {[soln]: true};
    } else if (soln.length === bestLen)
      map[soln] = true;
  }
  return Object.keys(map);
};

export const spiralizeMatrix = (grid) => {
  const result = [];
  while (grid.length > 0) {
    result.push(...grid.shift());
    if (grid.length === 0 || grid[0].length === 0) break;
    result.push(...grid.map(r=>r.pop()));
    result.push(...grid.pop().reverse());
    if (grid.length === 0 || grid[0].length === 0) break;
    result.push(...grid.map(r=>r.shift()).reverse());
  }
  return result;
};

export const pathToCorner = (grid) => {
  const h = grid.length;
  const w = grid[0].length;
  const k = (x,y)=>`${x},${y}`;
  const map = new Map();
  const gset = (x,y,v)=>!map.get(k(x,y))&&map.set(k(x,y),v);
  map.set(k(0,0), '');
  for (const [coords, path] of map) {
    const [x, y] = coords.split(',').map(Number);
    if (x===w-1 && y===h-1) return path;
    if (x+1<w  && grid[y][x+1]===0) gset(x+1,y,path+'R');
    if (x-1>=0 && grid[y][x-1]===0) gset(x-1,y,path+'L');
    if (y+1<h  && grid[y+1][x]===0) gset(x,y+1,path+'D');
    if (y-1>=0 && grid[y-1][x]===0) gset(x,y-1,path+'U');
  }
  return '';
};

export const lpf = (num) => {
  for (let f=2; f*f<num; f++)
    while (num%f===0) num/=f;
  return num;
};

const hammingExtract = (str) => {
  let result = '0b';
  let b = 4;
  for (let i = 3; i < str.length; i++) {
    if (i === b) b *= 2;
    else result += str[i];
  }
  return `${+result}`;
};

export const hammingCorrect = (str) => {
  const bits = str.split('').map(Number);
  let badbit = 0;
  for (let b = 1; b < str.length; b*=2) {
    let parity = 0;
    for (let i = 0; i < str.length; i++) {
      if (i&b) parity+=bits[i];
    }
    if (parity&1) badbit += b;
  }
  if (badbit>0)
    bits[badbit]^=1;
  else if (bits.reduce((a,b)=>a+b,0)%2)
    bits[0]^=1;
  return hammingExtract(bits);
};

export const stockProfit = (prices, n=1, s=0, c={}) => {
  let split = 0;
  const key = `${s},${prices.length},${n}`;
  if (c[key])
    return c[key];
  if (n > 1) {
    for (let i = 2; i < prices.length; i++) {
      const left = prices.slice(0, i);
      const right = prices.slice(i);
      const value = stockProfit(left, 1, s, c)+stockProfit(right, n-1, s+i, c);
      split = Math.max(split, value);
    }
  }
  let min = Infinity;
  let pro = 0;
  for (const price of prices) {
    min = Math.min(min, price);
    pro = Math.max(pro, price - min);
  }
  return c[key] = Math.max(pro, split);
};
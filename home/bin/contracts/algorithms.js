export const computeSumPermutations = (MAX) => {
  const arr = () => new Array(MAX+1).fill(1);
  const table = arr().map(arr);
  
  for (let sum = 2; sum <= MAX; sum++) {
    table[sum][1] = 1;
    for (let max = 2; max <= sum; max++) {
      table[sum][max] = table[sum][max-1] + table[sum-max][Math.min(max,sum-max)];
    }
  }
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
  for (let i = track.length - 2; i >= 0; i--)
    track[i] = 1 + Math.min(Infinity, ...track.slice(i+1, i+1+track[i]));
  return ~~track[0];
};

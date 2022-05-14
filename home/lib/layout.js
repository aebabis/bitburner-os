export class DynamicWindow {
  constructor(getContent, minWidth, minHeight) {
    this.minWidth = minWidth;
    this.minHeight = minHeight;
    this.getContent = getContent;
  }

  getData(WIDTH) {
    const text = this.getContent();
    const width = Math.min(WIDTH, this.minWidth);
    const height = this.minHeight;
    return { text, width, height, getText: this.getContent };
  }
}

export class GrowingWindow {
  constructor(getContent) {
    this.minWidth = 1;
    this.minHeight = 1;
    this.getContent = () => {
      const rows = getContent().split('\n');
      this.minWidth =  Math.max(this.minWidth, ...rows.map(s=>s.length));
      this.minHeight = Math.max(this.minHeight, rows.length);
      return rows;
    };
  }

  render(WIDTH) {
    const text = this.getContent();
    const width = Math.min(WIDTH, this.minWidth);
    const height = this.minHeight;
    return { text, width, height };
  }
}

export const renderWindows = (windows, WIDTH) => {
  const overlaps = ({x: r1x1, y: r1y1, width: r1w, height: r1h}) => {
    const r1x2 = r1x1 + r1w;
    const r1y2 = r1y1 + r1h;
    return ({ x: r2x1, y: r2y1, width: r2w, height: r2h }) => {
      const r2x2 = r2x1 + r2w;
      const r2y2 = r2y1 + r2h;
      return !(
        r2x2 < r1x1 || r2x1 > r1x2 || r2y2 < r1y1 || r2y1 > r1y2
      );
    };
  };

  const text = windows.map(win => win.render(WIDTH)).sort((a,b)=>a.text.length-b.text.length);

  const placed = [];
  let x = 0;
  let y = 0;
  while (text.length > 0) {
    while (true) {
      const item = text.find(item => (x + item.width <= WIDTH-2 || item.width >= WIDTH-2) &&
        !placed.some(overlaps({x, y, ...item})));
      if (item != null) {
        item.x = x;
        item.y = y;
        placed.push(item);
        text.splice(text.indexOf(item), 1);
        break;
      }
      x++;
      if (x > WIDTH-2) {
        x = 0;
        y++;
        let iter = placed.slice().reverse();
        let prev = iter.shift();
        for (const curr of iter) {
          if (Math.abs(curr.height - prev.height) <= 2) {
            curr.height = prev.height = Math.max(prev.height, curr.height);
          }
          prev = curr;
        }
      }
    }
  }

  const HEIGHT = Math.max(...placed.map(item => item.y + item.height))+2;

  placed.sort((a,b)=>a.x-b.x);
  for (const item of placed) {
    do {
      item.width++;
    } while (item.x+item.width<WIDTH-1&&
             !placed.filter(o=>o!==item).find(overlaps(item)));
    item.width-=1;
    do {
      item.height++;
    } while (item.y+item.height<HEIGHT-1&&
             !placed.filter(o=>o!==item).find(overlaps(item)));
    item.height--;
  }

  const grid = new Array(HEIGHT).fill(null).map(
    () => new Array(WIDTH).fill(' '));
  const lastRow = grid.length - 1;
  const lastCol = grid[0].length - 1;
  for (let x = 0; x < WIDTH; x++) {
    grid[0][x] = grid[lastRow][x] = '━';
  }
  for (let y = 0; y < HEIGHT; y++) {
    grid[y][0] = grid[y][lastCol] = '┃';
  }
  grid[0][0] = '┏';
  grid[0][lastCol] = '┓';
  grid[lastRow][0] = '┗';
  grid[lastRow][lastCol] = '┛';

  for (const box of placed) {
    const { x, y, width, height } = box;
    for (let xx = 0; xx < width; xx++) {
      if (y !== 0)
        grid[y][x+xx+1] = '─';
      if (y+height+1 !== HEIGHT-1)
        grid[y+height+1][x+xx+1] = '─';
    }
    for (let yy = 0; yy < height; yy++) {
      if (x !== 0)
        grid[y+yy+1][x] = '│';
      if (x+width+1 !== WIDTH-1)
        grid[y+yy+1][x+width+1] = '│';
    }
  }
  for (let i = 0; i < 2; i++)
  for (const box of placed) {
    const { x, y, width, height } = box;
    const drawCorner = (x, y) => {
      const top = y === 0;
      const left = x === 0;
      const right = x === WIDTH-1;
      const bottom = y === HEIGHT-1;

      if (left && !top && !bottom) {
        grid[y][x] = '┠';
      } else if (right && !top && !bottom) {
        grid[y][x] = '┨';
      } else if (top && !left && !right) {
        grid[y][x] = '┯';
      } else if (bottom && !left && !right) {
        grid[y][x] = '┷';
      } else if ((top+bottom+left+right)<2) {
        const topNeighbor =    !top && grid[y-1][x]!==' '?1:0;
        const rightNeighbor =  !right && grid[y][x+1]!==' '?2:0;
        const bottomNeighbor = !bottom && grid[y+1][x]!==' '?4:0;
        const leftNeighbor =   !left && grid[y][x-1]!==' '?8:0;
        const bitMask = leftNeighbor | bottomNeighbor | rightNeighbor |
              topNeighbor;
        const N = '.';
        const lookup = [N,N,N,'└',N,N,'┌','├',N,'┘',N,'┴','┐','┤','┬','┼'];
        grid[y][x] = lookup[bitMask];
      }
    };
    drawCorner(x, y);
    drawCorner(x+width+1, y);
    drawCorner(x, y+height+1);
    drawCorner(x+width+1, y+height+1);
  }
  for (const box of placed) {
    const { x, y, width, height, text, getText } = box;
    const drawn = getText ? getText(width, height) : text;
    for (let yy = 0; yy < height; yy++) {
      const row = drawn[yy] || ' '.repeat(drawn[0].length);
      for (let xx = 0; xx < width; xx++) {
        grid[y+yy+1][x+xx+1] = row[xx] || ' ';
      }
    }
  }
  return grid.map(x=>x.join('')).join('\n');
};
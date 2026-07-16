import { BRIGHT } from './colors';
import { length } from './util';

type ColumnSpec = {
  name?: string;
  align?: string;
  process?: (x: string | number) => string | null | undefined;
  empty?: string;
};
type TableColumn = {
  name: string;
  process: (x: string | number) => string;
  pad: (c: string | number, a: number) => string;
};

const headData = (column: ColumnSpec | string): TableColumn => {
  const spec: ColumnSpec = typeof column === 'string' ? {} : column;
  const name = typeof column === 'string' ? column : (column.name ?? '');
  const align = spec.align || 'left';
  const process = spec.process || ((x: string | number) => x);
  const empty = spec.empty || '-';
  return {
    name,
    process: (x: string | number) => {
      const str = process(x);
      return str == null ? empty : str.toString();
    },
    pad: (c: string | number, a) => {
      const str = c.toString();
      if (str === 'empty') {
        const left = Math.floor(a / 2);
        return str.padStart(left).padEnd(a - left);
      }
      const e = str.length - length(str);
      return align === 'left' ? str.padEnd(a + e) : str.padStart(a + e);
    },
  };
};

export const transpose = (lines: string[][], numCols: number) => {
  const numRows = Math.ceil(lines.length / numCols);
  const cols: string[][][] = [];
  for (let i = 0; i < numCols; i++) cols.push(lines.splice(0, numRows));

  const rows: string[][] = [];
  while (cols[0].length > 0) {
    const row = cols
      .map((col, i) => {
        const section = col?.shift();
        if (section && i < numCols - 1) section.push(' ');
        return section || '';
      })
      .flat();
    rows.push(row);
  }
  return rows;
};

export const table = (
  _: NS,
  columns: (string | ColumnSpec)[] | null,
  data: (string | number | undefined)[][],
  options: { borders?: boolean; colors?: boolean } = {},
) => {
  const { borders = false, colors = false } = options;
  const joiner = borders ? ' | ' : '  ';
  const head = colors ? BRIGHT.BOLD : (s: string) => s;
  let processedColumns: TableColumn[];
  if (columns == null) {
    if (data.length === 0) return '';
    processedColumns = data.shift()!.map((item) => headData(`${item ?? ''}`));
  } else {
    processedColumns = columns.map(headData);
  }
  const processedData = data.map((row) =>
    row.map((cell, i) => processedColumns[i].process(cell ?? '').toString()),
  );
  const widths = processedColumns.map((column, i) =>
    processedData
      .map((row) => length(row[i] || ''))
      .reduce((a, b) => Math.max(a, b), length(column.name)),
  );
  const lines = [
    head(processedColumns.map((column, i) => column.pad(column.name, widths[i])).join(joiner)),
    ...processedData.map((row) =>
      row.map((cell, i) => processedColumns[i].pad(cell, widths[i])).join(joiner),
    ),
  ].map((x) => ` ${x} `);
  return lines.join('\n');
};

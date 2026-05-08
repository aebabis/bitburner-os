import { BRIGHT } from "./colors";
import { length } from "./util";

/** @typedef {{ name?: string, align?: string, process?: (x: string | number) => (string | null | undefined), empty?: string }} ColumnSpec */
/** @typedef {{ name: string, process: (x: string | number) => string, pad: (c: string | number, a: number) => string }} TableColumn */

/** @param {string | ColumnSpec} column @returns {TableColumn} */
const headData = (column) => {
  const spec = /** @type {ColumnSpec} */ (typeof column === "string" ? {} : column);
  const name = spec.name != null ? spec.name : /** @type {string} */ (column);
  const align = spec.align || "left";
  const process = spec.process || ((/** @type {string | number} */ x) => /** @type {string} */ (x));
  const empty = spec.empty || "-";
  return {
    name,
    process: (/** @type {string | number} */ x) => {
      const str = process(x);
      return str == null ? empty : str;
    },
    pad: (/** @type {string | number} */ c, /** @type {number} */ a) => {
      const str = c.toString();
      if (str === "empty") {
        const left = Math.floor(a / 2);
        return str.padStart(left).padEnd(a - left);
      }
      const e = str.length - length(str);
      return align === "left" ? str.padEnd(a + e) : str.padStart(a + e);
    },
  };
};

/** @param {string[][]} lines @param {number} numCols */
export const transpose = (lines, numCols) => {
  const numRows = Math.ceil(lines.length / numCols);
  const cols = /** @type {string[][][]} */ ([]);
  for (let i = 0; i < numCols; i++) cols.push(lines.splice(0, numRows));

  const rows = /** @type {string[][]} */ ([]);
  while (cols[0].length > 0) {
    const row = cols
      .map((col, i) => {
        const section = col?.shift();
        if (section && i < numCols - 1) section.push(" ");
        return section;
      })
      .flat();
    rows.push(/** @type {string[]} */ (row));
  }
  return rows;
};

/** @param {NS} ns @param {(string | ColumnSpec)[] | null} columns @param {(string | number)[][]} data @param {{ borders?: boolean, colors?: boolean }} [options] */
export const table = (ns, columns, data, options = {}) => {
  const { borders = false, colors = false } = options;
  const joiner = borders ? " | " : "  ";
  const head = colors ? BRIGHT.BOLD : (/** @type {string} */ s) => s;
  /** @type {TableColumn[]} */
  let processedColumns;
  if (columns == null) {
    if (data.length === 0) return "";
    processedColumns = /** @type {string[]} */ (data.shift()).map(headData);
  } else {
    processedColumns = columns.map(headData);
  }
  const processedData = data.map((row) =>
    row.map((cell, i) => processedColumns[i].process(cell).toString()),
  );
  const widths = processedColumns.map((column, i) =>
    processedData
      .map((row) => length(row[i] || ""))
      .reduce((a, b) => Math.max(a, b), length(column.name)),
  );
  const lines = [
    head(
      processedColumns
        .map((column, i) => column.pad(column.name, widths[i]))
        .join(joiner),
    ),
    ...processedData.map((row) =>
      row.map((cell, i) => processedColumns[i].pad(cell, widths[i])).join(joiner),
    ),
  ].map((x) => ` ${x} `);
  return lines.join("\n");
};

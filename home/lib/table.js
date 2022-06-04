import { length } from './lib/util';

const headData = (column) => {
    const name = column.name != null ? column.name : column;
    const align = column.align || 'left';
    const process = column.process || (x => x);
    const empty = column.empty || '-';
    return {
        name,
        process: (x) => {
            const str = process(x);
            return str == null ? empty : str;
        },
        pad: (c, a) => {
            const str = c.toString();
            if (str === 'empty') {
                const left = Math.floor(a / 2);
                return str.padStart(left).padEnd(a - left);
            }
            const e = str.length - length(str);
            return (align === 'left') ?
                str.padEnd(a+e) : str.padStart(a+e);
        },
    };
};

/** @param {NS} ns */
export const transpose = (lines, numCols) => {
    const numRows = Math.ceil(lines.length / numCols);
    const cols = [];
    for (let i = 0; i < numCols; i++)
        cols.push(lines.splice(0, numRows));

    const rows = [];
    while (cols[0].length > 0) {
        const row = cols.map((col, i)=>{
            const section = col?.shift();
            if (section && i < numCols-1)
                section.push(' ');
            return section;
        }).flat();
        rows.push(row);
    }
    return rows;
};

/** @param {NS} ns */
export const table = (ns, columns, data, options={}) => {
    const { /*outline = true,*/ borders = false } = options;
    const joiner = borders ? ' | ' : '  ';
    if (columns == null) {
        if (data.length === 0)
            return '';
        columns = data.shift().map(headData);
    } else {
        columns = columns.map(headData);
    }
    data = data.map(row => row.map((cell, i) => columns[i].process(cell).toString()));
    const widths = columns.map((column, i) => data
        .map(row => length(row[i]||'')).reduce((a,b)=>Math.max(a,b),length(column.name)));
    const lines = [
        columns.map((column, i) => column.pad(column.name, widths[i])).join(joiner),
        ...data.map(row => row.map((cell, i) => columns[i].pad(cell, widths[i])).join(joiner)),
    ].map(x=>` ${x} `);
    return lines.join('\n');
};
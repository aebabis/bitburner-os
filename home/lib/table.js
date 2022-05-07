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
            return (align === 'left') ?
                str.padEnd(a) : str.padStart(a);
        },
    };
};

/** @param {NS} ns */
export const table = (ns, columns, data, options={}) => {
    const { /*outline = true,*/ borders = false } = options;
    const joiner = borders ? ' | ' : '  ';
    columns = columns.map(headData);
    data = data.map(row => row.map((cell, i) => columns[i].process(cell).toString()));
    const widths = columns.map((column, i) => data
        .map(row => row[i]?.length).reduce((a,b)=>Math.max(a,b),column.name.length));
    const lines = [
        columns.map((column, i) => column.pad(column.name, widths[i])).join(joiner),
        ...data.map(row => row.map((cell, i) => columns[i].pad(cell, widths[i])).join(joiner)),
    ].map(x=>` ${x} `);
    return lines.join('\n');
};
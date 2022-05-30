export const C_TITLE = '\u001b[1;4;35m';
export const C_MAIN = '\u001b[1;35m';
export const C_SUB = '\u001b[35m';
export const C_LIGHT = '\u001b[30m';

export const tprint = (ns) => (message) => {
	const length = Math.max(0, 20 - ns.getScriptName().length);
	ns.tprint(' '.repeat(length) + message);
}

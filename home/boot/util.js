export const tprint = (ns) => (message) => {
	const length = Math.max(0, 20 - ns.getScriptName().length);
	ns.tprint(' '.repeat(length) + message);
}

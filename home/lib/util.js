export const uuid = () => Math.random().toString().slice(2).toString(16);

// For use with Array.prototype.sort
export const by = (prop) => {
	let val = prop;
	if (typeof val !== 'function') {
		val = (obj) => {
			const ret = obj[prop];
			if (typeof ret === 'undefined') {
				throw new Error(`invalid prop ${prop}`);
			}
			return ret;
		}
	}
	return (a, b) => {
		const va = val(a);
		const vb = val(b);
		if (va < vb)
			return -1;
		else if (va > vb)
			return 1;
		else
			return 0;
	}
}

/** @param {NS} ns **/
export const write = (ns) => async (fullpath, src, mode, hostname='home') => {
    const filename = fullpath.split('/').pop();
    await ns.write(filename, src, mode);
    ns.mv(hostname, filename, fullpath);
}
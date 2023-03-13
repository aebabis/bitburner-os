const getRamUpgradeCost = (ns, ram=ns.getServerMaxRam('home')) => {
	let lg2 = 1;
	while (1 << lg2 < ram) lg2++;
	return ram * 32000 * 1.58 ** lg2;
}

/** @param {NS} ns */
export async function main(ns) {
	while (true) {
		const money = ns.getServerMoneyAvailable('home');
		if (getRamUpgradeCost(ns) < money)
			ns.toast('Buy RAM', 'info', 1000);
		await ns.sleep(1000);
	}
}
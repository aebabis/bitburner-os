/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    ns.installAugmentations('init.js');
}

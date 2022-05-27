typeof purchaseWseAccount; // Reserve RAM

/** @param {NS} ns */
export async function main(ns) {
    const [api] = ns.args;
    ns.stock[api]();
}
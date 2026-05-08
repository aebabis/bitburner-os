typeof purchaseWseAccount; // Reserve RAM

/** @param {NS} ns */
export async function main(ns) {
  const [api] = /** @type {('purchaseWseAccount' | 'purchaseTixApi' | 'purchase4SMarketDataTixApi' | 'purchase4SMarketData')[]} */ (ns.args);
  ns.stock[api]();
}

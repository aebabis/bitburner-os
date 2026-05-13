typeof purchaseWseAccount; // Reserve RAM

/** @param {NS} ns
 *  @param {'purchaseWseAccount' | 'purchaseTixApi' | 'purchase4SMarketDataTixApi' | 'purchase4SMarketData'} funcName */
const mayPurchase = (ns, funcName) => {
  if (funcName === 'purchaseWseAccount') {
    return true;
  } else if (funcName.includes('urchaseTixApi')) {
    return ns.stock.hasWseAccount();
  } else {
    return ns.stock.hasTixApiAccess();
  }
};

/** @param {NS} ns */
export async function main(ns) {
  const [funcName] = /** @type {('purchaseWseAccount' | 'purchaseTixApi' | 'purchase4SMarketDataTixApi' | 'purchase4SMarketData')[]} */ (ns.args);
  if (mayPurchase(ns, funcName)) {
    ns.stock[funcName]();
  }
}

typeof purchaseWseAccount; // Reserve RAM

type StockApiName =
  | 'purchaseWseAccount'
  | 'purchaseTixApi'
  | 'purchase4SMarketDataTixApi'
  | 'purchase4SMarketData';
const mayPurchase = (ns: NS, funcName: StockApiName) => {
  if (funcName === 'purchaseWseAccount') {
    return true;
  } else if (funcName.includes('urchaseTixApi')) {
    return ns.stock.hasWseAccount();
  } else {
    return ns.stock.hasTixApiAccess();
  }
};

export async function main(ns: NS) {
  const [funcName] =
    /** @type {('purchaseWseAccount' | 'purchaseTixApi' | 'purchase4SMarketDataTixApi' | 'purchase4SMarketData')[]} */ ns.args;
  if (mayPurchase(ns, funcName)) {
    ns.stock[funcName]();
  }
}
